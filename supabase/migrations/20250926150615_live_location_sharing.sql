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
-- NOTE: This function has been moved to migration 20250927202319_fix_location_sharing_function.sql
-- and updated to handle users without active locations properly
-- Function implementation moved to 20250927202319_fix_location_sharing_function.sql