-- Group carry-over: let a creator clone a group into a later festival.
--
-- groups.festival_id is NOT NULL with UNIQUE (name, festival_id), and there was
-- no clone path, so every festival a crew had to recreate their group from
-- scratch. carried_over_from records the lineage so we can tell which past
-- groups are already present in a festival, and so a future "vs. last year"
-- comparison has something to join on.

-- ON DELETE SET NULL: deleting last year's group must not cascade into this
-- year's, it just loses the lineage link.
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS carried_over_from uuid
  REFERENCES public.groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_groups_carried_over_from
  ON public.groups(carried_over_from);

COMMENT ON COLUMN public.groups.carried_over_from IS
  'Group in an earlier festival that this group continues. NULL for originals.';

-- Recreate create_group_with_member with a carry-over source argument.
-- Dropped first: adding a DEFAULT parameter alongside the existing 6-argument
-- signature would make every existing call ambiguous.
DROP FUNCTION IF EXISTS public.create_group_with_member(
  character varying, uuid, uuid, integer, uuid, character varying
);

CREATE FUNCTION public.create_group_with_member(
  p_group_name character varying,
  p_user_id uuid,
  p_festival_id uuid,
  p_winning_criteria_id integer DEFAULT 2,
  p_invite_token uuid DEFAULT NULL,
  p_password character varying DEFAULT NULL,
  p_carried_over_from uuid DEFAULT NULL
)
RETURNS TABLE (
  group_id uuid,
  group_name character varying,
  invite_token uuid,
  winning_criteria_id integer,
  festival_id uuid,
  created_by uuid,
  created_at timestamptz,
  carried_over_from uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
    v_group_id UUID;
    v_invite_token UUID;
    v_password VARCHAR;
    v_created_at TIMESTAMPTZ;
    v_source_creator UUID;
BEGIN
    -- Validate user_id is not null (basic sanity check)
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID cannot be null';
    END IF;

    -- This function is SECURITY DEFINER and reachable directly through PostgREST,
    -- so ownership of the carry-over source is re-checked here rather than
    -- trusting the service-layer isCreator check alone.
    IF p_carried_over_from IS NOT NULL THEN
        SELECT g.created_by INTO v_source_creator
        FROM groups g
        WHERE g.id = p_carried_over_from;

        IF v_source_creator IS NULL THEN
            RAISE EXCEPTION 'Source group % not found', p_carried_over_from;
        END IF;

        IF v_source_creator <> p_user_id THEN
            RAISE EXCEPTION 'Only the creator of group % can carry it over', p_carried_over_from;
        END IF;
    END IF;

    -- Generate invite token if not provided
    v_invite_token := COALESCE(p_invite_token, gen_random_uuid());

    -- Generate password if not provided
    v_password := COALESCE(p_password, encode(gen_random_bytes(32), 'hex'));

    -- Insert the group
    INSERT INTO groups (
      name, password, created_by, winning_criteria_id,
      festival_id, invite_token, carried_over_from
    )
    VALUES (
      p_group_name, v_password, p_user_id, p_winning_criteria_id,
      p_festival_id, v_invite_token, p_carried_over_from
    )
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
      v_created_at,
      p_carried_over_from;
END;
$function$;

-- Restore exactly the grants the dropped function had: authenticated and
-- service_role, nothing else. The REVOKEs are required, not decorative: a newly
-- created function picks up EXECUTE for PUBLIC by default (and anon via
-- Supabase's default privileges), which the old function did not have. This is
-- SECURITY DEFINER and takes p_user_id, so an anon caller with EXECUTE could
-- create groups on behalf of arbitrary users.
REVOKE ALL ON FUNCTION public.create_group_with_member(
  character varying, uuid, uuid, integer, uuid, character varying, uuid
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_group_with_member(
  character varying, uuid, uuid, integer, uuid, character varying, uuid
) FROM anon;

GRANT EXECUTE ON FUNCTION public.create_group_with_member(
  character varying, uuid, uuid, integer, uuid, character varying, uuid
) TO authenticated, service_role;
