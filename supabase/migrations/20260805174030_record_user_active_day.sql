-- Records daily app activity. SECURITY DEFINER so authenticated users can write
-- their own row without an INSERT policy on the table.
CREATE OR REPLACE FUNCTION public.record_user_active_day(
  p_user_id     uuid,
  p_platform    text DEFAULT NULL,
  p_app_version text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Callers may only record activity for themselves.
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'record_user_active_day: user mismatch';
  END IF;

  INSERT INTO user_active_days (user_id, day, platform, app_version)
  VALUES (p_user_id, current_date, p_platform, p_app_version)
  ON CONFLICT (user_id, day) DO UPDATE
    SET last_seen_at  = now(),
        request_count = user_active_days.request_count + 1,
        platform      = coalesce(excluded.platform, user_active_days.platform),
        app_version   = coalesce(excluded.app_version, user_active_days.app_version);
END;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and anon inherits it via PUBLIC.
-- The auth.uid() check above already stops anon from writing anyone's row (anon
-- has no JWT, so auth.uid() is NULL, and IS DISTINCT FROM only passes when
-- p_user_id is also NULL, which then fails user_active_days' NOT NULL/FK on
-- user_id) — but leaving it anon-executable still contradicts the explicit-grant
-- convention this repo just adopted for every other SECURITY DEFINER function
-- (see fix/harden-security-definer-grants). Revoke first, then grant narrowly.
REVOKE EXECUTE ON FUNCTION public.record_user_active_day(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_user_active_day(uuid, text, text) TO authenticated, service_role;
