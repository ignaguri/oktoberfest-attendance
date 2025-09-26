-- Create notification rate limiting table
CREATE TABLE notification_rate_limit (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_notification_rate_limit_lookup
ON notification_rate_limit (user_id, notification_type, group_id, created_at);

-- Add RLS policy
ALTER TABLE notification_rate_limit ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own rate limit records
CREATE POLICY "Users can view their own rate limit records"
ON notification_rate_limit FOR SELECT
USING (user_id = auth.uid());

-- Allow system to insert rate limit records
CREATE POLICY "System can insert rate limit records"
ON notification_rate_limit FOR INSERT
WITH CHECK (true);

-- Function to check if rate limit should apply (returns count of recent notifications)
CREATE OR REPLACE FUNCTION check_notification_rate_limit(
  p_user_id UUID,
  p_notification_type TEXT,
  p_group_id UUID,
  p_minutes_ago INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notification_rate_limit
    WHERE user_id = p_user_id
      AND notification_type = p_notification_type
      AND group_id = p_group_id
      AND created_at > NOW() - (p_minutes_ago || ' minutes')::INTERVAL
  );
END;
$$;

-- Function to record a new rate limit entry
CREATE OR REPLACE FUNCTION record_notification_rate_limit(
  p_user_id UUID,
  p_group_id UUID,
  p_notification_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notification_rate_limit (user_id, group_id, notification_type, created_at)
  VALUES (p_user_id, p_group_id, p_notification_type, NOW());
END;
$$;

-- Cleanup function to remove old rate limit records (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM notification_rate_limit
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Create a periodic cleanup job (commented out - would need pg_cron extension)
-- SELECT cron.schedule('cleanup-rate-limits', '0 2 * * *', 'SELECT cleanup_old_rate_limit_records();');