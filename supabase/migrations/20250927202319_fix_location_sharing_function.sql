-- Fix for get_nearby_group_members function to handle users without active locations
-- Also fix the unique constraint on user_locations table to only apply to active status

-- Fix the unique constraint to only prevent multiple active locations per user per festival
-- First drop the existing constraint
ALTER TABLE user_locations
DROP CONSTRAINT IF EXISTS unique_active_location_per_user_festival;

-- Create a new partial unique index for active locations only
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_location_per_user_festival
ON user_locations(user_id, festival_id)
WHERE status = 'active';

CREATE OR REPLACE FUNCTION get_nearby_group_members(
  input_user_id UUID,
  input_festival_id UUID,
  radius_meters INTEGER DEFAULT 500
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  distance_meters DECIMAL,
  last_updated TIMESTAMPTZ,
  group_names TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_lat DECIMAL;
  user_lng DECIMAL;
BEGIN
  -- First check if the user has an active location
  SELECT ul.latitude, ul.longitude INTO user_lat, user_lng
  FROM user_locations ul
  WHERE ul.user_id = input_user_id
    AND ul.festival_id = input_festival_id
    AND ul.status = 'active'
    AND ul.expires_at > NOW()
  LIMIT 1;

  -- If user has no active location, return empty result
  IF user_lat IS NULL OR user_lng IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ul.user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    ul.latitude,
    ul.longitude,
    -- Haversine distance calculation (approximation)
    (6371000 * acos(
      cos(radians(user_lat)) *
      cos(radians(ul.latitude)) *
      cos(radians(ul.longitude) - radians(user_lng)) +
      sin(radians(user_lat)) *
      sin(radians(ul.latitude))
    )) as distance_meters,
    ul.last_updated,
    array_agg(DISTINCT g.name) as group_names
  FROM user_locations ul
  JOIN profiles p ON p.id = ul.user_id
  JOIN group_members gm ON gm.user_id = ul.user_id
  JOIN groups g ON g.id = gm.group_id AND g.festival_id = input_festival_id
  WHERE ul.festival_id = input_festival_id
    AND ul.status = 'active'
    AND ul.expires_at > NOW()
    AND ul.user_id != input_user_id
    AND EXISTS (
      -- Only include users who share groups and have enabled sharing
      SELECT 1
      FROM location_sharing_preferences lsp
      JOIN group_members gm1 ON gm1.group_id = lsp.group_id AND gm1.user_id = lsp.user_id
      JOIN group_members gm2 ON gm2.group_id = lsp.group_id AND gm2.user_id = input_user_id
      WHERE lsp.user_id = ul.user_id
        AND lsp.festival_id = input_festival_id
        AND lsp.sharing_enabled = true
    )
    AND (6371000 * acos(
      cos(radians(user_lat)) *
      cos(radians(ul.latitude)) *
      cos(radians(ul.longitude) - radians(user_lng)) +
      sin(radians(user_lat)) *
      sin(radians(ul.latitude))
    )) <= radius_meters
  GROUP BY ul.user_id, p.username, p.full_name, p.avatar_url,
           ul.latitude, ul.longitude, ul.last_updated
  ORDER BY distance_meters ASC;
END;
$$;
