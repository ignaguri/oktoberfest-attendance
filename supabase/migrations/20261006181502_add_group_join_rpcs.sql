-- Group lookup, search and join for callers who are not members yet.
--
-- Safe to apply ahead of the deploy: the API moves onto these before
-- 20261006181504 removes the table access they replace. The one live change is
-- join_group_with_token losing its expiry check, which nothing calls today.
--
-- All three are SECURITY DEFINER because a non-member cannot read the group
-- row, and none of them ever returns `password`.

-- Resolve one group from its invite token. Knowing the token is the capability.
CREATE OR REPLACE FUNCTION public.get_group_by_invite_token(p_token uuid)
RETURNS TABLE (
  id uuid,
  name character varying,
  description text,
  festival_id uuid,
  winning_criteria_id integer,
  invite_token uuid,
  created_by uuid,
  carried_over_from uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
  SELECT g.id, g.name, g.description, g.festival_id, g.winning_criteria_id,
         g.invite_token, g.created_by, g.carried_over_from, g.created_at
  FROM groups g
  WHERE g.invite_token = p_token;
$function$;

-- Name search for the join sheet. Returns only what SearchGroupResultSchema
-- declares, so no token or password reaches a non-member.
CREATE OR REPLACE FUNCTION public.search_groups(
  p_name text,
  p_festival_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name character varying,
  festival_id uuid,
  member_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
  SELECT g.id, g.name, g.festival_id,
         (SELECT count(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
  FROM groups g
  -- Escaped so a bare % or _ cannot list every group.
  WHERE g.name ILIKE '%' || replace(replace(replace(p_name, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    AND (p_festival_id IS NULL OR g.festival_id = p_festival_id)
  ORDER BY g.name
  LIMIT least(greatest(p_limit, 1), 50);
$function$;

-- Same function, minus the TOKEN_EXPIRED branch. Nothing has ever enforced
-- token_expiration, and nearly every live invite link is past it, so checking
-- it here would break them all. Expiring tokens is a separate decision.
CREATE OR REPLACE FUNCTION public.join_group_with_token(p_user_id uuid, p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
    v_group_id UUID;
    v_group_name TEXT;
BEGIN
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

    SELECT id, name INTO v_group_id, v_group_name
    FROM groups
    WHERE invite_token = p_token;

    IF v_group_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOKEN_NOT_FOUND',
            'message', 'Invalid invitation token'
        );
    END IF;

    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, p_user_id)
    ON CONFLICT DO NOTHING;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_MEMBER',
            'message', 'You are already a member of this group',
            'group_name', v_group_name,
            'group_id', v_group_id
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'group_id', v_group_id,
        'group_name', v_group_name,
        'message', 'Successfully joined the group'
    );
END;
$function$;

-- Supabase default privileges grant new functions to anon and authenticated
-- directly, so PUBLIC alone is not enough.
REVOKE EXECUTE ON FUNCTION public.get_group_by_invite_token(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.search_groups(text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.join_group_with_token(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_by_invite_token(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_groups(text, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_group_with_token(uuid, uuid) TO authenticated, service_role;
