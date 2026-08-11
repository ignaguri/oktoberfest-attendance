-- record_user_active_day now reports whether it created the row.
--
-- The auth middleware calls this on every authenticated request. Achievement
-- evaluation needs to run at most once per user per day, so the caller needs to
-- know which call was the day's first. Postgres cannot change a function's
-- return type in place, so the whole function is replaced; the body is
-- unchanged apart from returning the insert outcome.
DROP FUNCTION IF EXISTS public.record_user_active_day(uuid, text, text);

CREATE FUNCTION public.record_user_active_day(
  p_user_id     uuid,
  p_platform    text DEFAULT NULL,
  p_app_version text DEFAULT NULL
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

  INSERT INTO user_active_days (user_id, day, platform, app_version)
  VALUES (p_user_id, current_date, p_platform, p_app_version)
  ON CONFLICT (user_id, day) DO UPDATE
    SET last_seen_at  = now(),
        request_count = user_active_days.request_count + 1,
        platform      = coalesce(excluded.platform, user_active_days.platform),
        app_version   = coalesce(excluded.app_version, user_active_days.app_version)
  RETURNING (xmax = 0) INTO v_inserted;

  RETURN coalesce(v_inserted, false);
END;
$$;

COMMENT ON FUNCTION public.record_user_active_day(uuid, text, text) IS
  'Records daily app activity. Returns true when this call created the day row, which the API uses to evaluate achievements at most once per user per day.';

REVOKE EXECUTE ON FUNCTION public.record_user_active_day(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_user_active_day(uuid, text, text) TO authenticated, service_role;
