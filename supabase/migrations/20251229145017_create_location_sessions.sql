-- Migration: Create location sessions (session-based location sharing)
-- Description: Replace user_locations with scalable session-based model
-- Date: 2025-12-29

-- ============================================================================
-- PART 1: Drop old location tables
-- ============================================================================

-- Drop old location sharing preferences table
DROP TABLE IF EXISTS location_sharing_preferences CASCADE;

-- Drop old user locations table
DROP TABLE IF EXISTS user_locations CASCADE;

-- ============================================================================
-- PART 2: Create new location session tables
-- ============================================================================

-- Create location_sessions table
-- Manages active location sharing sessions
CREATE TABLE location_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '4 hours',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT location_sessions_expires_after_start CHECK (expires_at > started_at)
);

-- Create partial unique index for one active session per user per festival
CREATE UNIQUE INDEX idx_location_sessions_one_active_per_user_festival
  ON location_sessions(user_id, festival_id, is_active)
  WHERE is_active = TRUE;

-- Indexes for location_sessions
CREATE INDEX idx_location_sessions_user ON location_sessions(user_id);
CREATE INDEX idx_location_sessions_festival ON location_sessions(festival_id);
CREATE INDEX idx_location_sessions_active ON location_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_location_sessions_expires ON location_sessions(expires_at) WHERE is_active = TRUE;

-- Comments
COMMENT ON TABLE location_sessions IS 'Active location sharing sessions with auto-expiration';
COMMENT ON COLUMN location_sessions.expires_at IS 'When the session automatically expires (default 4 hours)';
COMMENT ON COLUMN location_sessions.is_active IS 'Whether the session is currently active';

-- Create location_session_members table
-- Defines who can see a user's location (group-based visibility)
CREATE TABLE location_session_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES location_sessions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, group_id)
);

-- Indexes for location_session_members
CREATE INDEX idx_location_session_members_session ON location_session_members(session_id);
CREATE INDEX idx_location_session_members_group ON location_session_members(group_id);

-- Comments
COMMENT ON TABLE location_session_members IS 'Groups that can view a location session';
COMMENT ON COLUMN location_session_members.group_id IS 'Group members who can see this location';

-- Create location_points table
-- Append-only location history for active sessions
CREATE TABLE location_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES location_sessions(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT location_points_valid_latitude CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT location_points_valid_longitude CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT location_points_positive_accuracy CHECK (accuracy IS NULL OR accuracy >= 0)
);

-- Indexes for location_points
CREATE INDEX idx_location_points_session ON location_points(session_id);
CREATE INDEX idx_location_points_recorded ON location_points(recorded_at DESC);
CREATE INDEX idx_location_points_session_recorded ON location_points(session_id, recorded_at DESC);

-- Comments
COMMENT ON TABLE location_points IS 'Append-only location history for tracking user positions';
COMMENT ON COLUMN location_points.accuracy IS 'GPS accuracy in meters (optional)';
COMMENT ON COLUMN location_points.recorded_at IS 'When the location was recorded';

-- ============================================================================
-- PART 3: Row Level Security Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE location_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_session_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_points ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own sessions
CREATE POLICY "Users can view own location sessions"
  ON location_sessions
  FOR SELECT
  USING (user_id = auth.uid());

-- RLS: Users can insert their own sessions
CREATE POLICY "Users can insert own location sessions"
  ON location_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS: Users can update their own sessions
CREATE POLICY "Users can update own location sessions"
  ON location_sessions
  FOR UPDATE
  USING (user_id = auth.uid());

-- RLS: Users can delete their own sessions
CREATE POLICY "Users can delete own location sessions"
  ON location_sessions
  FOR DELETE
  USING (user_id = auth.uid());

-- RLS: Group members can view sessions shared with their groups
CREATE POLICY "Group members can view shared sessions"
  ON location_sessions
  FOR SELECT
  USING (
    id IN (
      SELECT lsm.session_id
      FROM location_session_members lsm
      JOIN group_members gm ON gm.group_id = lsm.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

-- RLS: Users can manage members for their own sessions
CREATE POLICY "Users can manage own session members"
  ON location_session_members
  FOR ALL
  USING (
    session_id IN (
      SELECT id FROM location_sessions WHERE user_id = auth.uid()
    )
  );

-- RLS: Group members can view session membership
CREATE POLICY "Group members can view session members"
  ON location_session_members
  FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- RLS: Users can insert location points for their own sessions
CREATE POLICY "Users can insert own location points"
  ON location_points
  FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM location_sessions WHERE user_id = auth.uid()
    )
  );

-- RLS: Users can view their own location points
CREATE POLICY "Users can view own location points"
  ON location_points
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM location_sessions WHERE user_id = auth.uid()
    )
  );

-- RLS: Group members can view location points of shared sessions
CREATE POLICY "Group members can view shared location points"
  ON location_points
  FOR SELECT
  USING (
    session_id IN (
      SELECT ls.id
      FROM location_sessions ls
      JOIN location_session_members lsm ON lsm.session_id = ls.id
      JOIN group_members gm ON gm.group_id = lsm.group_id
      WHERE gm.user_id = auth.uid()
        AND ls.is_active = TRUE
        AND ls.expires_at > NOW()
    )
  );

-- ============================================================================
-- PART 4: Helper Functions
-- ============================================================================

-- Function to auto-expire old sessions
CREATE OR REPLACE FUNCTION expire_old_location_sessions()
RETURNS VOID AS $$
BEGIN
  UPDATE location_sessions
  SET is_active = FALSE,
      updated_at = NOW()
  WHERE is_active = TRUE
    AND expires_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old location points (keep last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_location_points()
RETURNS VOID AS $$
BEGIN
  DELETE FROM location_points
  WHERE recorded_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 5: Triggers
-- ============================================================================

-- Trigger for updated_at on location_sessions
CREATE TRIGGER update_location_sessions_updated_at
  BEFORE UPDATE ON location_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION expire_old_location_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_location_points() TO authenticated;
