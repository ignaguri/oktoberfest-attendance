-- Activity Feed View Migration
-- Creates a unified view for displaying recent group member activities

-- Create activity types enum
CREATE TYPE activity_type_enum AS ENUM (
  'beer_count_update',
  'tent_checkin',
  'photo_upload',
  'group_join',
  'achievement_unlock'
);

-- Create activity feed view that aggregates recent activities from group members
CREATE OR REPLACE VIEW activity_feed AS
WITH recent_attendances AS (
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

-- Create index for efficient querying by festival and time
CREATE INDEX IF NOT EXISTS idx_activity_feed_festival_time
ON attendances(festival_id, GREATEST(created_at, updated_at) DESC);

CREATE INDEX IF NOT EXISTS idx_tent_visits_festival_time
ON tent_visits(festival_id, visit_date DESC);

CREATE INDEX IF NOT EXISTS idx_beer_pictures_time
ON beer_pictures(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_members_time
ON group_members(joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_achievements_time
ON user_achievements(unlocked_at DESC);

-- RLS policies for activity feed view
-- Users can only see activities from people they share groups with
CREATE POLICY "Users can view activity feed from shared group members"
  ON attendances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM v_user_shared_group_members v
      WHERE v.owner_id = attendances.user_id
        AND v.viewer_id = auth.uid()
        AND v.festival_id = attendances.festival_id
    )
    OR user_id = auth.uid() -- Users can always see their own activities
  );

-- Note: tent_visits, beer_pictures, group_members, and user_achievements
-- should have similar RLS policies added or updated to support activity feed visibility