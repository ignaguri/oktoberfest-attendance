-- =====================================================
-- Friendship Visibility Updates
-- =====================================================
-- Updates existing RLS policies to grant friends the same
-- visibility as shared-group members. Also updates the
-- activity_feed view to include friends' activities.
-- =====================================================

-- =====================================================
-- 1. ATTENDANCES: Add friend visibility
-- =====================================================
DROP POLICY IF EXISTS "Users can view activity feed from shared group members" ON public.attendances;

CREATE POLICY "Users can view activity feed from shared group members"
  ON public.attendances
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM v_user_shared_group_members v
      WHERE v.owner_id = attendances.user_id
      AND v.viewer_id = (SELECT auth.uid())
      AND v.festival_id = attendances.festival_id
    )
    OR is_friend((SELECT auth.uid()), attendances.user_id)
  );

-- =====================================================
-- 2. TENT_VISITS: Add friend visibility
-- =====================================================
DROP POLICY IF EXISTS "Users can view own tent visits and group members' visits" ON public.tent_visits;

CREATE POLICY "Users can view own tent visits and group members' visits"
  ON public.tent_visits
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM v_user_shared_group_members v
      WHERE v.owner_id = tent_visits.user_id
      AND v.viewer_id = (SELECT auth.uid())
      AND v.festival_id = tent_visits.festival_id
    )
    OR is_friend((SELECT auth.uid()), tent_visits.user_id)
  );

-- =====================================================
-- 3. BEER_PICTURES: Add friend visibility
-- =====================================================
DROP POLICY IF EXISTS "Users can view public beer pictures from group members" ON public.beer_pictures;

CREATE POLICY "Users can view public beer pictures from group members"
  ON public.beer_pictures
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'::photo_visibility_enum
    AND (
      EXISTS (
        SELECT 1 FROM attendances a
        JOIN v_user_shared_group_members v ON v.owner_id = beer_pictures.user_id AND v.festival_id = a.festival_id
        WHERE a.id = beer_pictures.attendance_id
        AND v.viewer_id = (SELECT auth.uid())
      )
      OR is_friend((SELECT auth.uid()), beer_pictures.user_id)
    )
  );

-- =====================================================
-- 4. RESERVATIONS: Add friend visibility
-- =====================================================
DROP POLICY IF EXISTS "Group members can view visible reservations in same festival" ON public.reservations;

CREATE POLICY "Group members can view visible reservations in same festival"
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (
    visible_to_groups = true
    AND (
      EXISTS (
        SELECT 1 FROM v_user_shared_group_members v
        WHERE v.owner_id = reservations.user_id
        AND v.viewer_id = (SELECT auth.uid())
        AND v.festival_id = reservations.festival_id
      )
      OR is_friend((SELECT auth.uid()), reservations.user_id)
    )
  );

-- =====================================================
-- 5. GROUP_MESSAGES: Add friend visibility
-- =====================================================
DROP POLICY IF EXISTS "Users can view messages" ON public.group_messages;

CREATE POLICY "Users can view messages"
  ON public.group_messages FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR visibility = 'public'
    OR EXISTS (
      SELECT 1 FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      JOIN public.groups g ON g.id = gm1.group_id
      WHERE gm1.user_id = (SELECT auth.uid())
      AND gm2.user_id = group_messages.user_id
      AND g.festival_id = group_messages.festival_id
    )
    OR is_friend((SELECT auth.uid()), group_messages.user_id)
  );

-- =====================================================
-- 6. ACTIVITY_FEED view: Add friends' activities
-- =====================================================
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
  SELECT uf.user_id, fest.id AS festival_id
  FROM user_friends uf
  CROSS JOIN (SELECT id FROM festivals) fest
),
recent_attendances AS (
  SELECT a.user_id,
    a.festival_id,
    'beer_count_update'::activity_type_enum AS activity_type,
    jsonb_build_object('beer_count', a.beer_count, 'date', a.date, 'attendance_id', a.id) AS activity_data,
    GREATEST(a.created_at, a.updated_at) AS activity_time,
    a.created_at,
    a.updated_at
  FROM attendances a
    JOIN visible_users vu ON vu.user_id = a.user_id AND vu.festival_id = a.festival_id
  WHERE GREATEST(a.created_at, a.updated_at) > (now() - '48:00:00'::interval)
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
    jsonb_build_object('achievement_id', ua.achievement_id, 'achievement_name', a.name, 'achievement_icon', a.icon, 'rarity', a.rarity) AS activity_data,
    ua.unlocked_at AS activity_time,
    ua.unlocked_at AS created_at,
    ua.unlocked_at AS updated_at
  FROM user_achievements ua
    JOIN achievements a ON a.id = ua.achievement_id
    JOIN visible_users vu ON vu.user_id = ua.user_id AND vu.festival_id = ua.festival_id
  WHERE ua.unlocked_at > (now() - '48:00:00'::interval)
),
all_activities AS (
  SELECT * FROM recent_attendances
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
