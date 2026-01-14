-- =====================================================
-- Migration: Update activity_feed view to use consumptions table
-- =====================================================
-- The activity_feed view was using attendances.beer_count which is now
-- deprecated. We've transitioned to the consumptions table for tracking
-- individual drinks with their types.
--
-- This migration updates the view to:
-- 1. Replace recent_attendances (which used beer_count=0) with recent_consumptions
-- 2. Include drink_type in activity_data for proper frontend display
-- 3. Aggregate by attendance and drink_type to avoid spam
-- =====================================================

DROP VIEW IF EXISTS public.activity_feed;

CREATE VIEW public.activity_feed
WITH (security_invoker = true)
AS
WITH user_group_members AS (
  -- Find all users who share a group with the current user
  SELECT DISTINCT gm2.user_id,
    gm2.group_id,
    g.festival_id
  FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    JOIN groups g ON g.id = gm1.group_id
  WHERE gm1.user_id = auth.uid() AND gm2.user_id <> auth.uid()
),
-- Aggregate consumptions by attendance and drink_type to show "drank X beers"
-- instead of individual "drank 1 beer" entries for each consumption
recent_consumptions AS (
  SELECT
    a.user_id,
    a.festival_id,
    'beer_count_update'::activity_type_enum AS activity_type,
    jsonb_build_object(
      'drink_type', c.drink_type::text,
      'drink_count', COUNT(*)::int,
      'beer_count', COUNT(*)::int, -- Keep beer_count for backwards compatibility
      'date', a.date,
      'attendance_id', a.id
    ) AS activity_data,
    MAX(c.recorded_at) AS activity_time,
    MIN(c.created_at) AS created_at,
    MAX(c.updated_at) AS updated_at
  FROM consumptions c
    JOIN attendances a ON a.id = c.attendance_id
    JOIN user_group_members ugm ON ugm.user_id = a.user_id AND ugm.festival_id = a.festival_id
  WHERE c.recorded_at > (now() - '48:00:00'::interval)
  GROUP BY a.user_id, a.festival_id, a.id, a.date, c.drink_type
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
    JOIN user_group_members ugm ON ugm.user_id = tv.user_id AND ugm.festival_id = tv.festival_id
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
    JOIN user_group_members ugm ON ugm.user_id = bp.user_id AND ugm.festival_id = a.festival_id
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
    JOIN user_group_members ugm ON ugm.user_id = gm.user_id AND ugm.festival_id = g.festival_id
  WHERE gm.joined_at > (now() - '48:00:00'::interval)
),
recent_achievements AS (
  SELECT ua.user_id,
    ua.festival_id,
    'achievement_unlock'::activity_type_enum AS activity_type,
    jsonb_build_object('achievement_id', ua.achievement_id, 'achievement_name', ach.name, 'achievement_icon', ach.icon, 'rarity', ach.rarity) AS activity_data,
    ua.unlocked_at AS activity_time,
    ua.unlocked_at AS created_at,
    ua.unlocked_at AS updated_at
  FROM user_achievements ua
    JOIN achievements ach ON ach.id = ua.achievement_id
    JOIN user_group_members ugm ON ugm.user_id = ua.user_id AND ugm.festival_id = ua.festival_id
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
