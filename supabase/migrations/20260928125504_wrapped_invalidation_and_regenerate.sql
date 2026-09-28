-- Wrapped cache invalidation gaps and the admin regenerate that could not seed.
--
-- Drinks live in consumptions, but only attendances, tent_visits,
-- user_achievements and beer_pictures invalidated the cache, so a drink logged
-- after a Wrapped was generated never showed. Profile name/avatar and group
-- membership are in Wrapped too. Same shape as the beer_pictures trigger
-- (20260924172539): SECURITY DEFINER so the DELETE passes RLS.

CREATE OR REPLACE FUNCTION public.trigger_consumption_cache_invalidation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target record;
BEGIN
  -- OLD is NULL on INSERT and NEW is NULL on DELETE; an UPDATE that moves a
  -- drink to another attendance invalidates both festivals.
  FOR v_target IN
    SELECT DISTINCT a.user_id, a.festival_id
    FROM attendances a
    WHERE a.id IN (OLD.attendance_id, NEW.attendance_id)
  LOOP
    PERFORM invalidate_wrapped_cache(v_target.user_id, v_target.festival_id);
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_profile_wrapped_cache_invalidation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM invalidate_wrapped_cache(NEW.id, NULL);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_group_member_wrapped_cache_invalidation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_festival_id uuid;
BEGIN
  -- When the whole group is deleted the row is already gone and the lookup
  -- finds nothing; that path is not worth a Wrapped refresh.
  SELECT g.festival_id INTO v_festival_id
  FROM groups g
  WHERE g.id = COALESCE(NEW.group_id, OLD.group_id);

  IF v_festival_id IS NOT NULL THEN
    PERFORM invalidate_wrapped_cache(COALESCE(NEW.user_id, OLD.user_id), v_festival_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Only ever run as triggers.
REVOKE EXECUTE ON FUNCTION public.trigger_consumption_cache_invalidation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_profile_wrapped_cache_invalidation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_group_member_wrapped_cache_invalidation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_consumptions_wrapped_cache_invalidation ON public.consumptions;
CREATE TRIGGER tr_consumptions_wrapped_cache_invalidation
AFTER INSERT OR UPDATE OR DELETE ON public.consumptions
FOR EACH ROW EXECUTE FUNCTION public.trigger_consumption_cache_invalidation();

DROP TRIGGER IF EXISTS tr_profiles_wrapped_cache_invalidation ON public.profiles;
CREATE TRIGGER tr_profiles_wrapped_cache_invalidation
AFTER UPDATE OF username, full_name, avatar_url ON public.profiles
FOR EACH ROW
WHEN (
  OLD.username IS DISTINCT FROM NEW.username
  OR OLD.full_name IS DISTINCT FROM NEW.full_name
  OR OLD.avatar_url IS DISTINCT FROM NEW.avatar_url
)
EXECUTE FUNCTION public.trigger_profile_wrapped_cache_invalidation();

DROP TRIGGER IF EXISTS tr_group_members_wrapped_cache_invalidation ON public.group_members;
CREATE TRIGGER tr_group_members_wrapped_cache_invalidation
AFTER INSERT OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.trigger_group_member_wrapped_cache_invalidation();

-- Regenerate used to UPDATE existing rows only, so "regenerate all" skipped
-- everyone who had never opened Wrapped. It now upserts every attendee of every
-- unlocked festival matching the filters. p_admin_user_id is kept for the
-- existing client signature and is ignored; authorization comes from the JWT.
CREATE OR REPLACE FUNCTION public.regenerate_wrapped_data_cache(
  p_user_id uuid DEFAULT NULL::uuid,
  p_festival_id uuid DEFAULT NULL::uuid,
  p_admin_user_id uuid DEFAULT NULL::uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_regenerated_count integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Insufficient permissions to regenerate cache'
      USING ERRCODE = '42501';
  END IF;

  WITH targets AS (
    SELECT DISTINCT a.user_id, a.festival_id
    FROM attendances a
    WHERE (p_user_id IS NULL OR a.user_id = p_user_id)
      AND (p_festival_id IS NULL OR a.festival_id = p_festival_id)
      AND now() >= wrapped_unlocks_at(a.festival_id)
  ),
  calculated AS (
    SELECT t.user_id, t.festival_id, get_wrapped_data(t.user_id, t.festival_id) AS new_data
    FROM targets t
  )
  INSERT INTO wrapped_data_cache (user_id, festival_id, wrapped_data, generated_by, data_version)
  SELECT c.user_id, c.festival_id, c.new_data, 'admin', wrapped_data_version()
  FROM calculated c
  WHERE c.new_data IS NOT NULL
  ON CONFLICT (user_id, festival_id)
  DO UPDATE SET
    wrapped_data = EXCLUDED.wrapped_data,
    generated_by = 'admin',
    data_version = EXCLUDED.data_version,
    updated_at = NOW();

  GET DIAGNOSTICS v_regenerated_count = ROW_COUNT;

  RETURN v_regenerated_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.regenerate_wrapped_data_cache(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_wrapped_data_cache(uuid, uuid, uuid) TO authenticated, service_role;
