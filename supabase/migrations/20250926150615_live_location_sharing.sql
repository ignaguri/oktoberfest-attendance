-- Live Location Sharing Migration
-- Creates tables and policies for live location sharing between group members

-- Create location sharing status enum
CREATE TYPE location_sharing_status_enum AS ENUM (
  'active',
  'paused',
  'expired'
);

-- Create user_locations table for storing live location data
CREATE TABLE user_locations (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(6, 2), -- Accuracy in meters
  heading DECIMAL(5, 2), -- Compass heading in degrees (0-360)
  speed DECIMAL(8, 4), -- Speed in m/s
  altitude DECIMAL(8, 2), -- Altitude in meters
  status location_sharing_status_enum NOT NULL DEFAULT 'active',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '4 hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one active location per user per festival
  CONSTRAINT unique_active_location_per_user_festival
  UNIQUE (user_id, festival_id, status)
  DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for efficient location queries
CREATE INDEX idx_user_locations_user_festival
ON user_locations(user_id, festival_id);

CREATE INDEX idx_user_locations_festival_status
ON user_locations(festival_id, status);

CREATE INDEX idx_user_locations_expires_at
ON user_locations(expires_at);

CREATE INDEX idx_user_locations_last_updated
ON user_locations(last_updated DESC);

-- Create spatial index for location queries (if PostGIS is available)
-- CREATE INDEX idx_user_locations_spatial
-- ON user_locations USING GIST(ST_Point(longitude, latitude));

-- Create location sharing preferences table
CREATE TABLE location_sharing_preferences (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  sharing_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_enable_on_checkin BOOLEAN NOT NULL DEFAULT false,
  notification_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One preference record per user per group per festival
  CONSTRAINT unique_location_preference_per_user_group_festival
  UNIQUE (user_id, group_id, festival_id)
);

-- Create indexes for location sharing preferences
CREATE INDEX idx_location_prefs_user_group
ON location_sharing_preferences(user_id, group_id);

CREATE INDEX idx_location_prefs_group_enabled
ON location_sharing_preferences(group_id, sharing_enabled);

-- Add updated_at triggers
CREATE TRIGGER update_user_locations_updated_at
  BEFORE UPDATE ON user_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_location_sharing_preferences_updated_at
  BEFORE UPDATE ON location_sharing_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on both tables
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_sharing_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_locations
-- Users can view their own locations
CREATE POLICY "Users can view own locations"
  ON user_locations FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert/update their own locations
CREATE POLICY "Users can manage own locations"
  ON user_locations FOR ALL
  USING (user_id = auth.uid());

-- Group members can view locations of users who are sharing with that group
CREATE POLICY "Group members can view shared locations"
  ON user_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM location_sharing_preferences lsp
      JOIN group_members gm1 ON gm1.group_id = lsp.group_id AND gm1.user_id = lsp.user_id
      JOIN group_members gm2 ON gm2.group_id = lsp.group_id AND gm2.user_id = auth.uid()
      WHERE lsp.user_id = user_locations.user_id
        AND lsp.festival_id = user_locations.festival_id
        AND lsp.sharing_enabled = true
        AND user_locations.status = 'active'
        AND user_locations.expires_at > NOW()
    )
  );

-- RLS policies for location_sharing_preferences
-- Users can manage their own preferences
CREATE POLICY "Users can manage own location preferences"
  ON location_sharing_preferences FOR ALL
  USING (user_id = auth.uid());

-- Group members can view preferences of other members in same group
CREATE POLICY "Group members can view group location preferences"
  ON location_sharing_preferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM group_members gm1
      JOIN group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = location_sharing_preferences.user_id
        AND gm2.user_id = auth.uid()
        AND gm1.group_id = location_sharing_preferences.group_id
    )
  );

-- Function to automatically expire old locations
CREATE OR REPLACE FUNCTION expire_old_locations()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_locations
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < NOW();
END;
$$;

-- Function to get nearby group members within a radius
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
BEGIN
  RETURN QUERY
  WITH user_location AS (
    SELECT ul.latitude, ul.longitude
    FROM user_locations ul
    WHERE ul.user_id = input_user_id
      AND ul.festival_id = input_festival_id
      AND ul.status = 'active'
      AND ul.expires_at > NOW()
    LIMIT 1
  ),
  nearby_users AS (
    SELECT
      ul.user_id,
      ul.latitude,
      ul.longitude,
      ul.last_updated,
      -- Haversine distance calculation (approximation)
      (6371000 * acos(
        cos(radians(user_loc.latitude)) *
        cos(radians(ul.latitude)) *
        cos(radians(ul.longitude) - radians(user_loc.longitude)) +
        sin(radians(user_loc.latitude)) *
        sin(radians(ul.latitude))
      )) as distance_meters
    FROM user_locations ul
    CROSS JOIN user_location user_loc
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
  )
  SELECT
    nu.user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    nu.latitude,
    nu.longitude,
    nu.distance_meters,
    nu.last_updated,
    array_agg(DISTINCT g.name) as group_names
  FROM nearby_users nu
  JOIN profiles p ON p.id = nu.user_id
  JOIN group_members gm ON gm.user_id = nu.user_id
  JOIN groups g ON g.id = gm.group_id AND g.festival_id = input_festival_id
  WHERE nu.distance_meters <= radius_meters
  GROUP BY nu.user_id, p.username, p.full_name, p.avatar_url,
           nu.latitude, nu.longitude, nu.distance_meters, nu.last_updated
  ORDER BY nu.distance_meters ASC;
END;
$$;