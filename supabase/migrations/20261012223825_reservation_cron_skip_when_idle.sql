-- The 5-minute job called Vercel on every tick, and each call costs Active CPU
-- even when nothing is due (almost always, outside festival season). Ask the
-- same rpcs the endpoint uses first, and only POST when one of them has rows.

CREATE OR REPLACE FUNCTION public.trigger_reservation_notifications()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  -- Fail open: if the check itself errors, call anyway and let the endpoint
  -- handle each rpc's error on its own, as it did before this check existed.
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.rpc_due_reservation_reminders(now()))
       AND NOT EXISTS (SELECT 1 FROM public.rpc_due_reservation_prompts(now())) THEN
      RETURN;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

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

REVOKE EXECUTE ON FUNCTION public.trigger_reservation_notifications() FROM PUBLIC, anon, authenticated, service_role;
