-- Fix early check-in logic in RPC functions
-- Skip sending prompts if user already has attendance for that day

CREATE OR REPLACE FUNCTION rpc_due_reservation_prompts(p_now timestamptz)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  festival_id uuid,
  tent_id uuid,
  start_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, r.festival_id, r.tent_id, r.start_at
  FROM reservations r
  JOIN user_notification_preferences p ON p.user_id = r.user_id
  JOIN festivals f ON f.id = r.festival_id
  WHERE r.status = 'scheduled'
    AND p.reminders_enabled = true
    AND r.prompt_sent_at IS NULL
    AND r.start_at <= p_now
    -- Skip if user already has attendance for the festival date
    AND NOT EXISTS (
      SELECT 1 FROM attendances a 
      WHERE a.user_id = r.user_id 
        AND a.festival_id = r.festival_id 
        AND a.date = DATE(r.start_at AT TIME ZONE f.timezone)
    );
END;
$$ LANGUAGE plpgsql STABLE;
