-- Harden SECURITY DEFINER functions that were executable by anon.
--
-- Postgres grants EXECUTE to PUBLIC by default, and `anon` inherits it. Every
-- SECURITY DEFINER function in this schema is owned by `postgres` (rolbypassrls),
-- so an anon-key holder calling one bypasses RLS entirely. The anon key ships in
-- the client bundle, so "anon can call it" means "anyone on the internet can".
--
-- 16 functions were reachable this way with no auth.uid() check of their own.
-- Every API route sits behind authMiddleware (packages/api/src/index.ts), so no
-- legitimate anon caller exists for any of them.
--
-- Three remedies are applied below:
--   1. Functions that trust a p_user_id parameter get an auth.uid() guard.
--   2. regenerate_wrapped_data_cache gets a real admin check (its old one was
--      skippable) and a pinned search_path.
--   3. All 16 get explicit grants: REVOKE FROM PUBLIC, anon (revoking from anon
--      alone is not enough, it inherits via PUBLIC), then GRANT to the roles
--      that actually call them.
--
-- The guard pattern mirrors the existing one in
-- 20260726190000_fix_wrapped_rls_and_comparisons.sql: allow when there is no
-- JWT (service_role), otherwise require the caller to be the subject or a
-- super admin.

-- ---------------------------------------------------------------------------
-- 1. Guards on functions that trust a caller-supplied user id
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_group_with_member(
    p_group_name character varying,
    p_user_id uuid,
    p_festival_id uuid,
    p_winning_criteria_id integer DEFAULT 2,
    p_invite_token uuid DEFAULT NULL::uuid,
    p_password character varying DEFAULT NULL::character varying
)
RETURNS TABLE(group_id uuid, group_name character varying, invite_token uuid, winning_criteria_id integer, festival_id uuid, created_by uuid, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_group_id UUID;
    v_invite_token UUID;
    v_password VARCHAR;
    v_created_at TIMESTAMPTZ;
BEGIN
    -- Validate user_id is not null (basic sanity check)
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID cannot be null';
    END IF;

    -- A caller with a JWT may only create a group for themselves.
    IF auth.uid() IS NOT NULL
       AND p_user_id <> auth.uid()
       AND NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Not authorized to create a group for another user'
            USING ERRCODE = '42501';
    END IF;

    -- Generate invite token if not provided
    v_invite_token := COALESCE(p_invite_token, gen_random_uuid());

    -- Generate password if not provided
    v_password := COALESCE(p_password, encode(gen_random_bytes(32), 'hex'));

    -- Insert the group
    INSERT INTO groups (name, password, created_by, winning_criteria_id, festival_id, invite_token)
    VALUES (p_group_name, v_password, p_user_id, p_winning_criteria_id, p_festival_id, v_invite_token)
    RETURNING id, groups.created_at INTO v_group_id, v_created_at;

    -- Insert the creator as a member of the group
    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, p_user_id);

    -- Return the created group details
    RETURN QUERY SELECT
      v_group_id,
      p_group_name,
      v_invite_token,
      p_winning_criteria_id,
      p_festival_id,
      p_user_id,
      v_created_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_group(
    p_user_id uuid,
    p_group_name character varying,
    p_password character varying,
    p_festival_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_group_id UUID;
    v_existing_member UUID;
BEGIN
    -- Validate user_id is not null
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID cannot be null';
    END IF;

    -- A caller with a JWT may only join a group as themselves.
    IF auth.uid() IS NOT NULL
       AND p_user_id <> auth.uid()
       AND NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Not authorized to join a group as another user'
            USING ERRCODE = '42501';
    END IF;

    -- Find group by name, password, and optionally festival_id
    IF p_festival_id IS NOT NULL THEN
        SELECT id INTO v_group_id
        FROM groups
        WHERE name = p_group_name
          AND password = p_password
          AND festival_id = p_festival_id;
    ELSE
        SELECT id INTO v_group_id
        FROM groups
        WHERE name = p_group_name
          AND password = p_password;
    END IF;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Group not found or incorrect password';
    END IF;

    -- Check if user is already a member
    SELECT user_id INTO v_existing_member
    FROM group_members
    WHERE group_id = v_group_id AND user_id = p_user_id;

    IF v_existing_member IS NOT NULL THEN
        RAISE EXCEPTION 'Already a member of this group';
    END IF;

    -- Add user to group
    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, p_user_id);

    RETURN v_group_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_group_with_token(
    p_user_id uuid,
    p_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_group_id UUID;
    v_group_name TEXT;
    v_token_expires_at TIMESTAMP;
    v_existing_member UUID;
BEGIN
    -- Validate user_id is not null
    IF p_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOKEN_NOT_FOUND',
            'message', 'User ID cannot be null'
        );
    END IF;

    -- A caller with a JWT may only redeem an invite for themselves.
    IF auth.uid() IS NOT NULL
       AND p_user_id <> auth.uid()
       AND NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Not authorized to join a group as another user'
            USING ERRCODE = '42501';
    END IF;

    -- Find group by invite token
    SELECT id, name, token_expiration INTO v_group_id, v_group_name, v_token_expires_at
    FROM groups
    WHERE invite_token = p_token;

    IF v_group_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOKEN_NOT_FOUND',
            'message', 'Invalid or expired invitation token'
        );
    END IF;

    -- Check if token has expired
    IF v_token_expires_at IS NOT NULL AND v_token_expires_at <= NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOKEN_EXPIRED',
            'message', 'This invitation token has expired',
            'expired_at', v_token_expires_at,
            'group_name', v_group_name,
            'group_id', v_group_id
        );
    END IF;

    -- Check if user is already a member
    SELECT user_id INTO v_existing_member
    FROM group_members
    WHERE group_id = v_group_id AND user_id = p_user_id;

    IF v_existing_member IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_MEMBER',
            'message', 'You are already a member of this group',
            'group_name', v_group_name,
            'group_id', v_group_id
        );
    END IF;

    -- Add user to group
    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, p_user_id);

    -- Return success response
    RETURN jsonb_build_object(
        'success', true,
        'group_id', v_group_id,
        'group_name', v_group_name,
        'message', 'Successfully joined the group'
    );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. regenerate_wrapped_data_cache: real admin check + pinned search_path
-- ---------------------------------------------------------------------------
-- The previous guard was wrapped in `IF p_admin_user_id IS NOT NULL THEN`, so
-- passing NULL skipped authorization entirely. It also trusted the caller's
-- claim about which admin they were. Authorization now comes from the JWT via
-- is_super_admin(); p_admin_user_id is retained for signature compatibility
-- (packages/api/src/repositories/supabase/wrapped.repository.ts still passes it)
-- but no longer grants anything.

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
  v_regenerated_count INTEGER := 0;
  v_query TEXT;
BEGIN
  -- Authorization comes from the JWT, not from p_admin_user_id. A caller with
  -- no JWT is service_role (cron / server-side), which is allowed.
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Insufficient permissions to regenerate cache'
      USING ERRCODE = '42501';
  END IF;

  -- Build dynamic query based on provided parameters
  v_query := '
    WITH calculated_data AS (
      SELECT
        wdc.user_id,
        wdc.festival_id,
        get_wrapped_data(wdc.user_id, wdc.festival_id) as new_data
      FROM wrapped_data_cache wdc
      WHERE 1=1';

  IF p_user_id IS NOT NULL THEN
    v_query := v_query || ' AND wdc.user_id = $1';
  END IF;

  IF p_festival_id IS NOT NULL THEN
    v_query := v_query || ' AND wdc.festival_id = $2';
  END IF;

  v_query := v_query || '
    )
    UPDATE wrapped_data_cache
    SET
      wrapped_data = calculated_data.new_data,
      generated_by = ''admin'',
      updated_at = NOW()
    FROM calculated_data
    WHERE wrapped_data_cache.user_id = calculated_data.user_id
      AND wrapped_data_cache.festival_id = calculated_data.festival_id
      AND calculated_data.new_data IS NOT NULL';

  -- Execute the query with appropriate parameters
  IF p_user_id IS NOT NULL AND p_festival_id IS NOT NULL THEN
    EXECUTE v_query USING p_user_id, p_festival_id;
    GET DIAGNOSTICS v_regenerated_count = ROW_COUNT;
  ELSIF p_user_id IS NOT NULL THEN
    EXECUTE v_query USING p_user_id;
    GET DIAGNOSTICS v_regenerated_count = ROW_COUNT;
  ELSIF p_festival_id IS NOT NULL THEN
    EXECUTE v_query USING p_festival_id;
    GET DIAGNOSTICS v_regenerated_count = ROW_COUNT;
  ELSE
    EXECUTE v_query;
    GET DIAGNOSTICS v_regenerated_count = ROW_COUNT;
  END IF;

  RETURN v_regenerated_count;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Explicit grants
-- ---------------------------------------------------------------------------

-- 3a. Maintenance, cron and notification internals: service_role only.
-- cleanup_* and expire_* take no arguments and delete rows, so anon EXECUTE was
-- an unauthenticated data-destruction vector.

REVOKE EXECUTE ON FUNCTION public.cleanup_old_location_points() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_location_points() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limit_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limit_records() TO service_role;

REVOKE EXECUTE ON FUNCTION public.expire_old_location_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_old_location_sessions() TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_notification_rate_limit(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_notification_rate_limit(uuid, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_notification_rate_limit(uuid, text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_notification_rate_limit(uuid, text, uuid, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_group_achievement_recipients(uuid[], uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_achievement_recipients(uuid[], uuid[]) TO service_role;

-- 3b. User-facing functions: authenticated + service_role, never anon.

-- RLS helper for the group_members policy, which is scoped to {authenticated}.
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated, service_role;

-- Legacy achievement engine. check_achievement_conditions and
-- evaluate_achievement_progress are called from evaluate_user_achievements and
-- get_user_achievements, which are SECURITY INVOKER, so the calling role needs
-- EXECUTE and authenticated must keep it.
REVOKE EXECUTE ON FUNCTION public.calculate_achievement_progress(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_achievement_progress(uuid, uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_achievement_conditions(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_achievement_conditions(uuid, uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.evaluate_achievement_progress(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_achievement_progress(uuid, uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_global_leaderboard(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard(integer, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_drink_price_cents(uuid, uuid, drink_type) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_drink_price_cents(uuid, uuid, drink_type) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_group_with_member(character varying, uuid, uuid, integer, uuid, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_with_member(character varying, uuid, uuid, integer, uuid, character varying) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.join_group(uuid, character varying, character varying, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group(uuid, character varying, character varying, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.join_group_with_token(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group_with_token(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.regenerate_wrapped_data_cache(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_wrapped_data_cache(uuid, uuid, uuid) TO authenticated, service_role;
