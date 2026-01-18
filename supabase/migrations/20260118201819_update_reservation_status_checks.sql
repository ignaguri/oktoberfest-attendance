-- Update reservation status from "scheduled" to "pending" in database functions
-- This migration changes the status checks in reminder/prompt functions to use
-- "pending" and "confirmed" instead of the deprecated "scheduled" status.

-- Update rpc_due_reservation_prompts to check for pending/confirmed status
CREATE OR REPLACE FUNCTION public.rpc_due_reservation_prompts(p_now timestamp with time zone)
RETURNS TABLE(id uuid, user_id uuid, festival_id uuid, tent_id uuid, start_at timestamp with time zone)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, r.festival_id, r.tent_id, r.start_at
  FROM reservations r
  JOIN user_notification_preferences p ON p.user_id = r.user_id
  JOIN festivals f ON f.id = r.festival_id
  WHERE r.status IN ('pending', 'confirmed')
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
$$;

-- Update rpc_due_reservation_reminders to check for pending/confirmed status
CREATE OR REPLACE FUNCTION public.rpc_due_reservation_reminders(p_now timestamp with time zone)
RETURNS TABLE(id uuid, user_id uuid, festival_id uuid, tent_id uuid, start_at timestamp with time zone, reminder_offset_minutes integer)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, r.festival_id, r.tent_id, r.start_at, r.reminder_offset_minutes
  FROM reservations r
  JOIN user_notification_preferences p ON p.user_id = r.user_id
  WHERE r.status IN ('pending', 'confirmed')
    AND p.reminders_enabled = true
    AND r.reminder_sent_at IS NULL
    AND (r.start_at - make_interval(mins => r.reminder_offset_minutes)) <= p_now;
END;
$$;

-- Update any existing reservations with "scheduled" status to "pending"
UPDATE reservations SET status = 'pending' WHERE status = 'scheduled';

-- Update the default status for new reservations (if using "scheduled" default)
ALTER TABLE reservations ALTER COLUMN status SET DEFAULT 'pending';
