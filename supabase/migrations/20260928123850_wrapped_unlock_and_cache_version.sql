-- Wrapped unlock rule, cache versioning, status and archive.
--
-- Wrapped used to unlock on festivals.status = 'ended', which nothing ever sets
-- (Oktoberfest 2026 was still 'upcoming' mid-festival). It now unlocks at 00:00
-- in the festival's timezone on the day after end_date, and the rule lives here
-- so no client can compute or cache a Wrapped early.
--
-- The cache had no TTL and no version, so changing get_wrapped_data left old
-- shapes cached forever. data_version is compared with wrapped_data_version();
-- any migration that changes get_wrapped_data output must bump that constant.

CREATE OR REPLACE FUNCTION public.wrapped_unlocks_at(p_festival_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT ((f.end_date + 1)::timestamp AT TIME ZONE COALESCE(f.timezone, 'Europe/Berlin'))
  FROM festivals f
  WHERE f.id = p_festival_id;
$$;

COMMENT ON FUNCTION public.wrapped_unlocks_at(uuid) IS
  'Instant a festival''s Wrapped unlocks: 00:00 local (festivals.timezone) on end_date + 1.';

-- Bump this in the same migration as any change to get_wrapped_data output.
CREATE OR REPLACE FUNCTION public.wrapped_data_version()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 1 $$;

COMMENT ON FUNCTION public.wrapped_data_version() IS
  'Current shape version of get_wrapped_data. Cached rows with another version are recomputed. Bump on every get_wrapped_data output change.';

ALTER TABLE public.wrapped_data_cache
  ADD COLUMN IF NOT EXISTS data_version integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.get_wrapped_status(p_festival_id uuid)
RETURNS TABLE(unlocks_at timestamptz, is_unlocked boolean, has_attendance boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_unlocks_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  v_unlocks_at := wrapped_unlocks_at(p_festival_id);
  IF v_unlocks_at IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_unlocks_at,
    (now() >= v_unlocks_at OR public.is_super_admin()),
    EXISTS (
      SELECT 1 FROM attendances a
      WHERE a.user_id = v_user_id AND a.festival_id = p_festival_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_wrapped_festivals()
RETURNS TABLE(
  festival_id uuid,
  name text,
  start_date date,
  end_date date,
  unlocks_at timestamptz,
  viewed boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    f.id,
    f.name::text,
    f.start_date,
    f.end_date,
    wrapped_unlocks_at(f.id),
    EXISTS (
      SELECT 1 FROM wrapped_views v
      WHERE v.user_id = auth.uid() AND v.festival_id = f.id
    )
  FROM festivals f
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM attendances a
      WHERE a.user_id = auth.uid() AND a.festival_id = f.id
    )
    AND now() >= wrapped_unlocks_at(f.id)
  ORDER BY f.start_date DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_wrapped_data_cached(p_user_id uuid, p_festival_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cached_data jsonb;
  v_calculated_data jsonb;
  v_is_unlocked boolean;
BEGIN
  IF auth.uid() IS NOT NULL
     AND p_user_id <> auth.uid()
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized to read wrapped data for another user'
      USING ERRCODE = '42501';
  END IF;

  v_is_unlocked := now() >= COALESCE(wrapped_unlocks_at(p_festival_id), 'infinity'::timestamptz);

  IF NOT v_is_unlocked AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'WRAPPED_NOT_READY' USING ERRCODE = 'P0001';
  END IF;

  -- Super admin preview of a locked festival: compute, never cache, so no
  -- pre-unlock row can outlive the festival's last day.
  IF NOT v_is_unlocked THEN
    RETURN get_wrapped_data(p_user_id, p_festival_id);
  END IF;

  SELECT wrapped_data INTO v_cached_data
  FROM wrapped_data_cache
  WHERE user_id = p_user_id
    AND festival_id = p_festival_id
    AND data_version = wrapped_data_version();

  IF v_cached_data IS NOT NULL THEN
    RETURN v_cached_data;
  END IF;

  v_calculated_data := get_wrapped_data(p_user_id, p_festival_id);

  IF v_calculated_data IS NOT NULL THEN
    INSERT INTO wrapped_data_cache (user_id, festival_id, wrapped_data, generated_by, data_version)
    VALUES (p_user_id, p_festival_id, v_calculated_data, 'system', wrapped_data_version())
    ON CONFLICT (user_id, festival_id)
    DO UPDATE SET
      wrapped_data = EXCLUDED.wrapped_data,
      generated_by = EXCLUDED.generated_by,
      data_version = EXCLUDED.data_version,
      updated_at = NOW();
  END IF;

  RETURN v_calculated_data;
END;
$$;

COMMENT ON FUNCTION public.get_wrapped_data_cached(uuid, uuid) IS
  'Cached Wrapped for a user and festival. Raises WRAPPED_NOT_READY before wrapped_unlocks_at unless super admin (computed, not cached). Rows with a stale data_version are recomputed.';

-- Supabase default privileges grant new functions to anon and authenticated
-- directly, so PUBLIC alone is not enough: revoke by name.
REVOKE EXECUTE ON FUNCTION public.wrapped_unlocks_at(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wrapped_unlocks_at(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.wrapped_data_version() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wrapped_data_version() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_wrapped_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wrapped_status(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_wrapped_festivals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wrapped_festivals() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_wrapped_data_cached(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wrapped_data_cached(uuid, uuid) TO authenticated, service_role;
