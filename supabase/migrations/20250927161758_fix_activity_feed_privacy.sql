-- Fix Activity Feed Privacy Migration
-- Updates activity feed to only show activities from users who share groups with the current user

-- Drop the existing view and recreate with proper group filtering
DROP VIEW IF EXISTS activity_feed;

-- Create improved activity feed view that only shows activities from shared group members
CREATE OR REPLACE VIEW activity_feed AS
WITH user_group_members AS (
  -- Get all users who share at least one group with the current user
  SELECT DISTINCT gm2.user_id, gm2.group_id, g.festival_id
  FROM group_members gm1
  JOIN group_members gm2 ON gm1.group_id = gm2.group_id
  JOIN groups g ON g.id = gm1.group_id
  WHERE gm1.user_id = auth.uid()
    AND gm2.user_id != auth.uid() -- Don't include current user in shared members
),
recent_attendances AS (
  -- Beer count updates (when attendance is created or updated)
  SELECT
    a.user_id,
    a.festival_id,
    'beer_count_update'::activity_type_enum as activity_type,
    jsonb_build_object(
      'beer_count', a.beer_count,
      'date', a.date,
      'attendance_id', a.id
    ) as activity_data,
    GREATEST(a.created_at, a.updated_at) as activity_time,
    a.created_at,
    a.updated_at
  FROM attendances a
  JOIN user_group_members ugm ON ugm.user_id = a.user_id AND ugm.festival_id = a.festival_id
  WHERE GREATEST(a.created_at, a.updated_at) > NOW() - INTERVAL '48 hours'
),
recent_tent_visits AS (
  -- Tent check-ins
  SELECT
    tv.user_id,
    tv.festival_id,
    'tent_checkin'::activity_type_enum as activity_type,
    jsonb_build_object(
      'tent_id', tv.tent_id,
      'tent_name', t.name,
      'visit_date', tv.visit_date
    ) as activity_data,
    tv.visit_date as activity_time,
    tv.visit_date as created_at,
    tv.visit_date as updated_at
  FROM tent_visits tv
  JOIN tents t ON t.id = tv.tent_id
  JOIN user_group_members ugm ON ugm.user_id = tv.user_id AND ugm.festival_id = tv.festival_id
  WHERE tv.visit_date > NOW() - INTERVAL '48 hours'
),
recent_photos AS (
  -- Photo uploads
  SELECT
    bp.user_id,
    a.festival_id,
    'photo_upload'::activity_type_enum as activity_type,
    jsonb_build_object(
      'picture_url', bp.picture_url,
      'attendance_id', bp.attendance_id,
      'date', a.date
    ) as activity_data,
    bp.created_at as activity_time,
    bp.created_at,
    bp.created_at as updated_at
  FROM beer_pictures bp
  JOIN attendances a ON a.id = bp.attendance_id
  JOIN user_group_members ugm ON ugm.user_id = bp.user_id AND ugm.festival_id = a.festival_id
  WHERE bp.created_at > NOW() - INTERVAL '48 hours'
    AND bp.visibility = 'public' -- Only show public photos
),
recent_group_joins AS (
  -- Group joins
  SELECT
    gm.user_id,
    g.festival_id,
    'group_join'::activity_type_enum as activity_type,
    jsonb_build_object(
      'group_id', g.id,
      'group_name', g.name
    ) as activity_data,
    gm.joined_at as activity_time,
    gm.joined_at as created_at,
    gm.joined_at as updated_at
  FROM group_members gm
  JOIN groups g ON g.id = gm.group_id
  JOIN user_group_members ugm ON ugm.user_id = gm.user_id AND ugm.festival_id = g.festival_id
  WHERE gm.joined_at > NOW() - INTERVAL '48 hours'
),
recent_achievements AS (
  -- Achievement unlocks
  SELECT
    ua.user_id,
    ua.festival_id,
    'achievement_unlock'::activity_type_enum as activity_type,
    jsonb_build_object(
      'achievement_id', ua.achievement_id,
      'achievement_name', a.name,
      'achievement_icon', a.icon,
      'rarity', a.rarity
    ) as activity_data,
    ua.unlocked_at as activity_time,
    ua.unlocked_at as created_at,
    ua.unlocked_at as updated_at
  FROM user_achievements ua
  JOIN achievements a ON a.id = ua.achievement_id
  JOIN user_group_members ugm ON ugm.user_id = ua.user_id AND ugm.festival_id = ua.festival_id
  WHERE ua.unlocked_at > NOW() - INTERVAL '48 hours'
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

-- Enable RLS on the view (this is handled automatically for views based on underlying tables)