-- Feed tent attribution, plus the day-start notification's preference,
-- dedupe ledger and recipient lookup.
--
-- The view is recreated in full: Postgres has no partial view replacement.
-- Base is 20260811120000_drop_legacy_achievement_engine_and_rarity.sql; the
-- only change is recent_consumptions, which now groups by tent and carries it
-- in activity_data.

DROP VIEW IF EXISTS public.activity_feed;

CREATE VIEW public.activity_feed
WITH (security_invoker = true)
AS
WITH user_group_members AS (
  SELECT DISTINCT gm2.user_id,
    gm2.group_id,
    g.festival_id
  FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    JOIN groups g ON g.id = gm1.group_id
  WHERE gm1.user_id = auth.uid() AND gm2.user_id <> auth.uid()
),
user_friends AS (
  SELECT
    CASE
      WHEN f.requester_id = auth.uid() THEN f.addressee_id
      ELSE f.requester_id
    END AS user_id
  FROM friendships f
  WHERE f.status = 'accepted'
  AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
),
visible_users AS (
  SELECT DISTINCT user_id, festival_id FROM user_group_members
  UNION
  SELECT DISTINCT uf.user_id, a.festival_id
  FROM user_friends uf
  JOIN attendances a ON a.user_id = uf.user_id
  WHERE GREATEST(a.created_at, a.updated_at) > (now() - '48:00:00'::interval)
),
-- Grouped by tent as well as drink type. LEFT JOIN so a drink logged without a
-- tent still appears, with tent_name null.
recent_consumptions AS (
  SELECT
    a.user_id,
    a.festival_id,
    'beer_count_update'::activity_type_enum AS activity_type,
    jsonb_build_object(
      'drink_type', c.drink_type::text,
      'drink_count', COUNT(*)::int,
      'beer_count', COUNT(*)::int,
      'date', a.date,
      'attendance_id', a.id,
      'tent_id', c.tent_id,
      'tent_name', t.name
    ) AS activity_data,
    MAX(c.recorded_at) AS activity_time,
    MIN(c.created_at) AS created_at,
    MAX(c.updated_at) AS updated_at
  FROM consumptions c
    JOIN attendances a ON a.id = c.attendance_id
    LEFT JOIN tents t ON t.id = c.tent_id
    JOIN visible_users vu ON vu.user_id = a.user_id AND vu.festival_id = a.festival_id
  WHERE c.recorded_at > (now() - '48:00:00'::interval)
  GROUP BY a.user_id, a.festival_id, a.id, a.date, c.drink_type, c.tent_id, t.name
),
recent_tent_visits AS (
  SELECT tv.user_id,
    tv.festival_id,
    'tent_checkin'::activity_type_enum AS activity_type,
    jsonb_build_object('tent_id', tv.tent_id, 'tent_name', t.name, 'visit_date', tv.visit_date) AS activity_data,
    tv.visit_date AS activity_time,
    tv.visit_date AS created_at,
    tv.visit_date AS updated_at
  FROM tent_visits tv
    JOIN tents t ON t.id = tv.tent_id
    JOIN visible_users vu ON vu.user_id = tv.user_id AND vu.festival_id = tv.festival_id
  WHERE tv.visit_date > (now() - '48:00:00'::interval)
),
recent_photos AS (
  SELECT bp.user_id,
    a.festival_id,
    'photo_upload'::activity_type_enum AS activity_type,
    jsonb_build_object('picture_url', bp.picture_url, 'attendance_id', bp.attendance_id, 'date', a.date) AS activity_data,
    bp.created_at AS activity_time,
    bp.created_at,
    bp.created_at AS updated_at
  FROM beer_pictures bp
    JOIN attendances a ON a.id = bp.attendance_id
    JOIN visible_users vu ON vu.user_id = bp.user_id AND vu.festival_id = a.festival_id
  WHERE bp.created_at > (now() - '48:00:00'::interval)
    AND bp.visibility = 'public'::photo_visibility_enum
),
recent_group_joins AS (
  SELECT gm.user_id,
    g.festival_id,
    'group_join'::activity_type_enum AS activity_type,
    jsonb_build_object('group_id', g.id, 'group_name', g.name) AS activity_data,
    gm.joined_at AS activity_time,
    gm.joined_at AS created_at,
    gm.joined_at AS updated_at
  FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    JOIN visible_users vu ON vu.user_id = gm.user_id AND vu.festival_id = g.festival_id
  WHERE gm.joined_at > (now() - '48:00:00'::interval)
),
recent_achievements AS (
  SELECT ua.user_id,
    ua.festival_id,
    'achievement_unlock'::activity_type_enum AS activity_type,
    jsonb_build_object('achievement_id', ua.achievement_id, 'achievement_name', ach.name, 'achievement_icon', ach.icon, 'rarity', tier_to_rarity(ach.tier)) AS activity_data,
    ua.unlocked_at AS activity_time,
    ua.unlocked_at AS created_at,
    ua.unlocked_at AS updated_at
  FROM user_achievements ua
    JOIN achievements ach ON ach.id = ua.achievement_id
    JOIN visible_users vu ON vu.user_id = ua.user_id AND vu.festival_id = ua.festival_id
  WHERE ua.unlocked_at > (now() - '48:00:00'::interval)
),
all_activities AS (
  SELECT * FROM recent_consumptions
  UNION ALL
  SELECT * FROM recent_tent_visits
  UNION ALL
  SELECT * FROM recent_photos
  UNION ALL
  SELECT * FROM recent_group_joins
  UNION ALL
  SELECT * FROM recent_achievements
)
SELECT
  aa.user_id,
  aa.festival_id,
  aa.activity_type,
  aa.activity_data,
  aa.activity_time,
  p.username,
  p.full_name,
  p.avatar_url
FROM all_activities aa
  JOIN profiles p ON p.id = aa.user_id
ORDER BY aa.activity_time DESC;

GRANT SELECT ON public.activity_feed TO authenticated;

-- The day-start opt-out. Defaults true, like every other toggle on this table.
ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS day_start_enabled boolean DEFAULT true;

-- One row per (actor, festival, day) ever announced. The insert is the claim:
-- ON CONFLICT DO NOTHING ... RETURNING returns a row only to the writer that
-- won, which is what makes "first drink or check-in of the day" exactly-once
-- across the four endpoints that can produce it, even when the mobile sync
-- queue flushes a backlog concurrently.
CREATE TABLE public.day_start_notifications (
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, festival_id, date)
);

ALTER TABLE public.day_start_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.day_start_notifications FROM anon, authenticated;
GRANT ALL ON public.day_start_notifications TO service_role;

-- Friends plus group-mates in this festival.
--
-- is_friend() cannot be used here: it reads auth.uid(), which is null for the
-- service role that calls this.
CREATE OR REPLACE FUNCTION public.get_day_start_recipients(
  p_actor_id uuid,
  p_festival_id uuid
)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT uid FROM (
    SELECT CASE WHEN f.requester_id = p_actor_id THEN f.addressee_id
                ELSE f.requester_id END AS uid
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (f.requester_id = p_actor_id OR f.addressee_id = p_actor_id)
    UNION
    SELECT v.viewer_id
    FROM public.v_user_shared_group_members v
    WHERE v.owner_id = p_actor_id
      AND v.festival_id = p_festival_id
  ) r
  WHERE uid <> p_actor_id;
$$;

-- Revoked from anon and authenticated BY NAME, not just from PUBLIC: Supabase's
-- default privileges grant EXECUTE on new functions to those roles directly, so
-- revoking from PUBLIC alone leaves them able to call it.
REVOKE EXECUTE ON FUNCTION public.get_day_start_recipients(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_day_start_recipients(uuid, uuid) TO service_role;
