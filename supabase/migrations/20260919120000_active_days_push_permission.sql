-- Record the device's notification permission on user_active_days.
--
-- The mobile app sends X-Client-Push-Permission (granted | denied |
-- undetermined) and the auth middleware passes it here. It separates app users
-- who denied notifications from users whose push token never reached Novu,
-- which the push delivery numbers alone cannot tell apart.
--
-- A new parameter means replacing the function. The body below is the one from
-- 20260810074755_record_user_active_day_returns_bool.sql plus the new column,
-- and it keeps that function's user-mismatch guard: dropping it would let any
-- signed-in user write another user's activity through this SECURITY DEFINER
-- function.
ALTER TABLE public.user_active_days
  ADD COLUMN IF NOT EXISTS push_permission text
  CHECK (push_permission IN ('granted', 'denied', 'undetermined'));

DROP FUNCTION IF EXISTS public.record_user_active_day(uuid, text, text);

CREATE FUNCTION public.record_user_active_day(
  p_user_id         uuid,
  p_platform        text DEFAULT NULL,
  p_app_version     text DEFAULT NULL,
  p_push_permission text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'record_user_active_day: user mismatch';
  END IF;

  INSERT INTO user_active_days (user_id, day, platform, app_version, push_permission)
  VALUES (p_user_id, current_date, p_platform, p_app_version, p_push_permission)
  ON CONFLICT (user_id, day) DO UPDATE
    SET last_seen_at    = now(),
        request_count   = user_active_days.request_count + 1,
        platform        = coalesce(excluded.platform, user_active_days.platform),
        app_version     = coalesce(excluded.app_version, user_active_days.app_version),
        push_permission = coalesce(excluded.push_permission, user_active_days.push_permission)
  RETURNING (xmax = 0) INTO v_inserted;

  RETURN coalesce(v_inserted, false);
END;
$$;
COMMENT ON FUNCTION public.record_user_active_day(uuid, text, text, text) IS
  'Records daily app activity. Returns true when this call created the day row, which the API uses to evaluate achievements at most once per user per day.';

REVOKE EXECUTE ON FUNCTION public.record_user_active_day(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_user_active_day(uuid, text, text, text) TO authenticated, service_role;
