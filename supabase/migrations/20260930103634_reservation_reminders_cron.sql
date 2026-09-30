-- Reservation reminders and check-in prompts were only sent by the daily Vercel
-- cron (09:00 UTC, the Hobby plan's limit), so anything due after that went out
-- the next morning. pg_cron now calls a dedicated endpoint every 5 minutes.

-- 1. Never send a stale notification. A reminder more than 15 minutes past its
--    due time (or after the reservation began) is noise, and so is a check-in
--    prompt hours later. An offset of 0 means "No reminder" (the mobile form's
--    label), so those rows never get one.

CREATE OR REPLACE FUNCTION public.rpc_due_reservation_reminders(p_now timestamp with time zone)
RETURNS TABLE(id uuid, user_id uuid, festival_id uuid, tent_id uuid, start_at timestamp with time zone, reminder_offset_minutes integer)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, r.festival_id, r.tent_id, r.start_at, r.reminder_offset_minutes
  FROM day_plans r
  JOIN user_notification_preferences p ON p.user_id = r.user_id
  WHERE r.kind = 'reservation'
    AND r.status IN ('pending', 'confirmed')
    AND p.reminders_enabled = true
    AND r.reminder_sent_at IS NULL
    AND r.reminder_offset_minutes > 0
    AND (r.start_at - make_interval(mins => r.reminder_offset_minutes)) <= p_now
    AND (r.start_at - make_interval(mins => r.reminder_offset_minutes)) > p_now - interval '15 minutes'
    AND r.start_at > p_now;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_due_reservation_prompts(p_now timestamp with time zone)
RETURNS TABLE(id uuid, user_id uuid, festival_id uuid, tent_id uuid, start_at timestamp with time zone)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.user_id, r.festival_id, r.tent_id, r.start_at
  FROM day_plans r
  JOIN user_notification_preferences p ON p.user_id = r.user_id
  JOIN festivals f ON f.id = r.festival_id
  WHERE r.kind = 'reservation'
    AND r.status IN ('pending', 'confirmed')
    AND p.reminders_enabled = true
    AND r.prompt_sent_at IS NULL
    AND r.start_at <= p_now
    AND r.start_at > p_now - interval '6 hours'
    -- Skip if user already has attendance for the festival date
    AND NOT EXISTS (
      SELECT 1 FROM attendances a
      WHERE a.user_id = r.user_id
        AND a.festival_id = r.festival_id
        AND a.date = DATE(r.start_at AT TIME ZONE f.timezone)
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_due_reservation_prompts(timestamp with time zone) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_due_reservation_reminders(timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_due_reservation_prompts(timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_due_reservation_reminders(timestamp with time zone) TO service_role;

-- 2. Every 5 minutes, POST to /api/cron/reservations.
--    The URL and secret live in Vault, not here (public repo). Set them once
--    per environment; until both exist the job is a no-op:
--      SELECT vault.create_secret('https://www.prostcounter.fun/api/cron/reservations', 'reservation_cron_url');
--      SELECT vault.create_secret('<CRON_SECRET>', 'cron_secret');
--    Use the www host: the apex 308-redirects and pg_net does not follow it.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE OR REPLACE FUNCTION public.trigger_reservation_notifications()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'reservation_cron_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('x-cron-secret', v_secret),
    timeout_milliseconds := 30000
  );
END;
$$;

-- Only the pg_cron job (running as postgres) calls this.
REVOKE EXECUTE ON FUNCTION public.trigger_reservation_notifications() FROM PUBLIC, anon, authenticated, service_role;

-- cron.schedule upserts by job name, so re-running this migration is safe.
SELECT cron.schedule(
  'reservation-notifications',
  '*/5 * * * *',
  $cron$SELECT public.trigger_reservation_notifications()$cron$
);
