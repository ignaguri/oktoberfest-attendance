-- Day plans and tent reservations in the activity feed.
--
-- A plan row is edited in place (a plan becomes a reservation by flipping
-- kind, a hidden plan becomes visible by flipping visible_to_groups), so
-- neither created_at nor updated_at says when it is news: created_at misses
-- those changes and updated_at also moves on note edits. feed_at is that
-- moment, kept by a trigger so clients cannot backdate or bump it.

ALTER TABLE public.day_plans ADD COLUMN feed_at timestamptz;

-- Backfill without the updated_at trigger, which would stamp every row.
ALTER TABLE public.day_plans DISABLE TRIGGER update_day_plans_updated_at;
UPDATE public.day_plans SET feed_at = COALESCE(created_at, now());
ALTER TABLE public.day_plans ENABLE TRIGGER update_day_plans_updated_at;

ALTER TABLE public.day_plans
  ALTER COLUMN feed_at SET DEFAULT now(),
  ALTER COLUMN feed_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_day_plan_feed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT'
    OR NEW.kind IS DISTINCT FROM OLD.kind
    OR (NEW.visible_to_groups AND NOT OLD.visible_to_groups)
  THEN
    NEW.feed_at := now();
  ELSE
    NEW.feed_at := OLD.feed_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_day_plan_feed_at
  BEFORE INSERT OR UPDATE ON public.day_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_day_plan_feed_at();

CREATE INDEX idx_day_plans_feed_at ON public.day_plans (feed_at);

-- The view is recreated in full: Postgres has no partial view replacement.
-- Base is 20260922120000_feed_tents_and_day_start_notifications.sql; the
-- existing CTEs are unchanged, and three are added for day plans.

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
-- Day plans skip visible_users: its friend branch needs an attendance in the
-- last 48h, and people plan before they go. day_plans' own RLS (the view is
-- security_invoker) already limits rows to friends and group-mates, and only
-- visible ones, which is the audience the plans UI shows them to.
recent_plan_rows AS (
  SELECT dp.id, dp.user_id, dp.festival_id, dp.date, dp.feed_at
  FROM day_plans dp
    JOIN festivals f ON f.id = dp.festival_id
  WHERE dp.kind = 'plan'
    AND dp.user_id <> auth.uid()
    AND dp.feed_at > (now() - '48:00:00'::interval)
    AND dp.date >= (now() AT TIME ZONE f.timezone)::date
),
-- Groups are named only to their members; a tagged group the viewer is not in
-- drops out. The viewer is flagged rather than named, so clients can say "you".
recent_plan_companions AS (
  SELECT DISTINCT p.user_id, p.festival_id,
    COALESCE(pr.username, pr.full_name, g.name) AS name,
    c.user_id IS NOT DISTINCT FROM auth.uid() AS is_viewer
  FROM recent_plan_rows p
    JOIN day_plan_companions c ON c.plan_id = p.id
    LEFT JOIN profiles pr ON pr.id = c.user_id
    LEFT JOIN group_members viewer_gm
      ON viewer_gm.group_id = c.group_id AND viewer_gm.user_id = auth.uid()
    LEFT JOIN groups g ON g.id = viewer_gm.group_id
),
-- One item per person: marking five days is one piece of news, not five.
recent_day_plans AS (
  SELECT p.user_id,
    p.festival_id,
    'day_plan'::activity_type_enum AS activity_type,
    jsonb_build_object(
      'dates', jsonb_agg(p.date ORDER BY p.date),
      'companions', COALESCE((
        SELECT jsonb_agg(rc.name ORDER BY rc.name)
        FROM recent_plan_companions rc
        WHERE rc.user_id = p.user_id
          AND rc.festival_id = p.festival_id
          AND rc.name IS NOT NULL
          AND NOT rc.is_viewer
      ), '[]'::jsonb),
      'includes_viewer', EXISTS (
        SELECT 1
        FROM recent_plan_companions rc
        WHERE rc.user_id = p.user_id
          AND rc.festival_id = p.festival_id
          AND rc.is_viewer
      )
    ) AS activity_data,
    MAX(p.feed_at) AS activity_time,
    MIN(p.feed_at) AS created_at,
    MAX(p.feed_at) AS updated_at
  FROM recent_plan_rows p
  GROUP BY p.user_id, p.festival_id
),
-- timezone rides along so clients show the arrival time as it was booked.
recent_reservations AS (
  SELECT dp.user_id,
    dp.festival_id,
    'tent_reservation'::activity_type_enum AS activity_type,
    jsonb_build_object(
      'tent_id', dp.tent_id,
      'tent_name', t.name,
      'date', dp.date,
      'start_at', dp.start_at,
      'timezone', f.timezone
    ) AS activity_data,
    dp.feed_at AS activity_time,
    dp.feed_at AS created_at,
    dp.feed_at AS updated_at
  FROM day_plans dp
    JOIN tents t ON t.id = dp.tent_id
    JOIN festivals f ON f.id = dp.festival_id
  WHERE dp.kind = 'reservation'
    AND dp.status NOT IN ('cancelled', 'expired')
    AND dp.user_id <> auth.uid()
    AND dp.feed_at > (now() - '48:00:00'::interval)
    AND dp.date >= (now() AT TIME ZONE f.timezone)::date
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
  UNION ALL
  SELECT * FROM recent_day_plans
  UNION ALL
  SELECT * FROM recent_reservations
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
