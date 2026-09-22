-- Invite a specific person into a group you created.
--
-- The mirror image of group_join_requests: there the person asks and the
-- creator answers; here the creator asks and the person answers. It gets its
-- own table because the two directions disagree about who may accept and about
-- what the decline cooldown protects.
--
-- The table is read through RLS and written only through the SECURITY DEFINER
-- functions below, which return jsonb {success, error_code} like the
-- join-request functions do.

CREATE TYPE public.group_invitation_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');

CREATE TABLE public.group_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.group_invitation_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT group_invitations_no_self CHECK (inviter_id <> invitee_id),
  CONSTRAINT group_invitations_responded_at_set CHECK (status = 'pending' OR responded_at IS NOT NULL)
);

-- One live invitation per person per group; answered rows are kept because the
-- decline cooldown reads them
CREATE UNIQUE INDEX group_invitations_one_pending
  ON public.group_invitations (group_id, invitee_id)
  WHERE status = 'pending';

CREATE INDEX group_invitations_invitee_pending
  ON public.group_invitations (invitee_id)
  WHERE status = 'pending';

-- Unfiltered so it also serves the decline-cooldown lookup (status = 'declined') and the
-- creator's sent-invitations list; group_invitations_one_pending already covers the
-- pending-only case with group_id leading, so a filtered (group_id) index would be redundant
CREATE INDEX group_invitations_group_invitee
  ON public.group_invitations (group_id, invitee_id);

ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.group_invitations FROM anon;

CREATE POLICY "Invitees can view their own invitations"
  ON public.group_invitations
  FOR SELECT
  TO authenticated
  USING (invitee_id = (SELECT auth.uid()));

CREATE POLICY "Group creators can view invitations for their groups"
  ON public.group_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = group_invitations.group_id
        AND g.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Super admins can do anything"
  ON public.group_invitations
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ---------------------------------------------------------------------------
-- invite_to_group
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.invite_to_group(p_group_id uuid, p_invitee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invitation_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  -- Covers a missing group too, so a non-creator cannot probe for existence
  IF NOT EXISTS (
    SELECT 1 FROM public.groups WHERE id = p_group_id AND created_by = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_GROUP_CREATOR');
  END IF;

  IF p_invitee_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CANNOT_INVITE_SELF');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_invitee_id) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PROFILE_NOT_FOUND');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = p_invitee_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_GROUP_MEMBER');
  END IF;

  -- They already asked to join; the creator should answer that request instead
  -- of creating a second pending object pointing the other way
  IF EXISTS (
    SELECT 1
    FROM public.group_join_requests
    WHERE group_id = p_group_id
      AND requester_id = p_invitee_id
      AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOIN_REQUEST_PENDING');
  END IF;

  -- A recent decline reports the same code as a pending invitation, so the
  -- creator cannot tell they were turned down
  IF EXISTS (
    SELECT 1
    FROM public.group_invitations
    WHERE group_id = p_group_id
      AND invitee_id = p_invitee_id
      AND (
        status = 'pending'
        OR (status = 'declined' AND responded_at > now() - interval '7 days')
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'GROUP_INVITATION_PENDING');
  END IF;

  INSERT INTO public.group_invitations (group_id, inviter_id, invitee_id)
  VALUES (p_group_id, v_user_id, p_invitee_id)
  RETURNING id INTO v_invitation_id;

  -- Inviting again soon after withdrawing does not notify them again, so a
  -- cancel/re-invite loop cannot be used to push the same person repeatedly.
  -- The mirror of request_to_join_group's notify_creator.
  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation_id,
    'notify_invitee', NOT EXISTS (
      SELECT 1
      FROM public.group_invitations
      WHERE group_id = p_group_id
        AND invitee_id = p_invitee_id
        AND status = 'cancelled'
        AND responded_at > now() - interval '24 hours'
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Two concurrent invites: the partial unique index let only one through
    RETURN jsonb_build_object('success', false, 'error_code', 'GROUP_INVITATION_PENDING');
END;
$$;

-- ---------------------------------------------------------------------------
-- accept_group_invitation
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.accept_group_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invitation record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  SELECT i.id, i.group_id, i.inviter_id, i.invitee_id, i.status, g.festival_id
  INTO v_invitation
  FROM public.group_invitations i
  JOIN public.groups g ON g.id = i.group_id
  WHERE i.id = p_invitation_id
  FOR UPDATE OF i;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'GROUP_INVITATION_NOT_FOUND');
  END IF;

  -- Recipient before status on purpose: the other order lets anyone holding an
  -- invitation id tell a live invitation from an answered one by the code alone
  IF v_invitation.invitee_id IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_INVITATION_RECIPIENT');
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'GROUP_INVITATION_NOT_FOUND');
  END IF;

  -- They may have joined through the invite link in the meantime
  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_invitation.group_id, v_invitation.invitee_id)
  ON CONFLICT (user_id, group_id) DO NOTHING;

  UPDATE public.group_invitations
  SET status = 'accepted', responded_at = now()
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', p_invitation_id,
    'group_id', v_invitation.group_id,
    'inviter_id', v_invitation.inviter_id,
    'invitee_id', v_invitation.invitee_id,
    'festival_id', v_invitation.festival_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- decline_group_invitation: the invitee turns it down; nobody is notified
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.decline_group_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invitation record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  SELECT i.id, i.group_id, i.invitee_id, i.status
  INTO v_invitation
  FROM public.group_invitations i
  WHERE i.id = p_invitation_id
  FOR UPDATE OF i;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'GROUP_INVITATION_NOT_FOUND');
  END IF;

  -- Recipient before status on purpose: the other order lets anyone holding an
  -- invitation id tell a live invitation from an answered one by the code alone
  IF v_invitation.invitee_id IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_INVITATION_RECIPIENT');
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'GROUP_INVITATION_NOT_FOUND');
  END IF;

  UPDATE public.group_invitations
  SET status = 'declined', responded_at = now()
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', p_invitation_id,
    'group_id', v_invitation.group_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- cancel_group_invitation: the creator withdraws a pending invitation
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.cancel_group_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invitation record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  -- Authorized on the group's creator rather than on inviter_id, so the check
  -- still holds if someone else is ever allowed to send invitations
  SELECT i.id, i.status, g.created_by
  INTO v_invitation
  FROM public.group_invitations i
  JOIN public.groups g ON g.id = i.group_id
  WHERE i.id = p_invitation_id
  FOR UPDATE OF i;

  IF NOT FOUND OR v_invitation.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'GROUP_INVITATION_NOT_FOUND');
  END IF;

  IF v_invitation.created_by IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_GROUP_CREATOR');
  END IF;

  UPDATE public.group_invitations
  SET status = 'cancelled', responded_at = now()
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object('success', true, 'invitation_id', p_invitation_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- list_my_group_invitations
--
-- SECURITY DEFINER on purpose: a pending invitee is not a member, so reading
-- the group's name would otherwise mean reading `groups` as a non-member. This
-- returns a narrow projection instead; invite_token and password never leave
-- the function. g.name is varchar(255), hence the ::text cast.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.list_my_group_invitations()
RETURNS TABLE (
  id uuid,
  group_id uuid,
  group_name text,
  festival_id uuid,
  created_at timestamptz,
  inviter_id uuid,
  inviter_username text,
  inviter_full_name text,
  inviter_avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.group_id,
    g.name::text,
    g.festival_id,
    i.created_at,
    i.inviter_id,
    p.username,
    p.full_name,
    p.avatar_url
  FROM public.group_invitations i
  JOIN public.groups g ON g.id = i.group_id
  LEFT JOIN public.profiles p ON p.id = i.inviter_id
  WHERE i.invitee_id = auth.uid()
    AND i.status = 'pending'
    -- Someone who joined through an invite link meanwhile has nothing to accept
    AND NOT EXISTS (
      SELECT 1
      FROM public.group_members m
      WHERE m.group_id = i.group_id AND m.user_id = i.invitee_id
    )
  ORDER BY i.created_at ASC;
$$;

-- ---------------------------------------------------------------------------
-- resolve_group_invitations_on_join
--
-- Someone can join through the invite link, or have a join request approved,
-- while an invitation to the same group is still open. Without this the row
-- stays 'pending' forever: both lists hide it for as long as they are a member,
-- but it reappears the moment they leave, and invite_to_group then refuses a
-- fresh invitation because of that zombie row.
--
-- SECURITY DEFINER because group_invitations carries no write policy at all:
-- every write goes through the functions in this file.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.resolve_group_invitations_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.group_invitations
  SET status = 'accepted', responded_at = now()
  WHERE group_id = NEW.group_id
    AND invitee_id = NEW.user_id
    AND status = 'pending';

  RETURN NEW;
END;
$$;

CREATE TRIGGER group_members_resolve_invitations
  AFTER INSERT ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_group_invitations_on_join();

-- ---------------------------------------------------------------------------
-- request_to_join_group (replaced)
--
-- Unchanged except for the invitation guard: invite_to_group already refuses
-- when a join request is pending, but the other direction knew nothing about
-- invitations, so the same pair could end up with one of each and the creator
-- would see that person in both sections of the group settings screen.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_to_join_group(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_request_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  -- A group without a creator has nobody to approve the request
  IF NOT EXISTS (
    SELECT 1 FROM public.groups WHERE id = p_group_id AND created_by IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'GROUP_NOT_FOUND');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_GROUP_MEMBER');
  END IF;

  -- An invitation to this group is already waiting for them. Answering it is
  -- the shorter path, and it keeps the pair from holding one pending object in
  -- each direction. Unlike the decline cooldown this is not a secret: the
  -- invitation is on their own groups screen already.
  IF EXISTS (
    SELECT 1
    FROM public.group_invitations
    WHERE group_id = p_group_id
      AND invitee_id = v_user_id
      AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'GROUP_INVITATION_RECEIVED');
  END IF;

  -- A recent decline reports the same code as a pending request, so the
  -- requester cannot tell they were declined
  IF EXISTS (
    SELECT 1
    FROM public.group_join_requests
    WHERE group_id = p_group_id
      AND requester_id = v_user_id
      AND (
        status = 'pending'
        OR (status = 'declined' AND responded_at > now() - interval '7 days')
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOIN_REQUEST_PENDING');
  END IF;

  INSERT INTO public.group_join_requests (group_id, requester_id)
  VALUES (p_group_id, v_user_id)
  RETURNING id INTO v_request_id;

  -- Asking again soon after withdrawing does not notify the creator again
  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'notify_creator', NOT EXISTS (
      SELECT 1
      FROM public.group_join_requests
      WHERE group_id = p_group_id
        AND requester_id = v_user_id
        AND status = 'cancelled'
        AND responded_at > now() - interval '24 hours'
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Two concurrent requests: the partial unique index let only one through
    RETURN jsonb_build_object('success', false, 'error_code', 'JOIN_REQUEST_PENDING');
END;
$$;

-- Supabase's default privileges grant new functions to anon and authenticated
-- directly, so REVOKE FROM PUBLIC alone is not enough; both are named here
REVOKE ALL ON FUNCTION public.invite_to_group(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_group_invitation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decline_group_invitation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_group_invitation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_group_invitations() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.invite_to_group(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_group_invitation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_group_invitation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_group_invitation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_my_group_invitations() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.resolve_group_invitations_on_join() FROM PUBLIC, anon, authenticated;
