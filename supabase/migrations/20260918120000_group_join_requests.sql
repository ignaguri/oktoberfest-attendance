-- Request to join a group.
--
-- People who find a group by name can ask to join; the group's creator accepts
-- (the requester becomes a member) or declines (silently; the requester can ask
-- again after 7 days). Invite links keep joining instantly and do not use this.
--
-- The table is read through RLS and written only through the SECURITY DEFINER
-- functions below, which return jsonb {success, error_code} like the friendship
-- functions do.

CREATE TYPE public.group_join_request_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE public.group_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.group_join_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

-- One live request per person per group; accepted/declined rows are kept
CREATE UNIQUE INDEX group_join_requests_one_pending
  ON public.group_join_requests (group_id, requester_id)
  WHERE status = 'pending';

CREATE INDEX group_join_requests_group_pending
  ON public.group_join_requests (group_id)
  WHERE status = 'pending';

CREATE INDEX group_join_requests_requester
  ON public.group_join_requests (requester_id);

ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.group_join_requests FROM anon;

CREATE POLICY "Requesters can view their own join requests"
  ON public.group_join_requests
  FOR SELECT
  TO authenticated
  USING (requester_id = (SELECT auth.uid()));

CREATE POLICY "Group creators can view join requests for their groups"
  ON public.group_join_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = group_join_requests.group_id
        AND g.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Super admins can do anything"
  ON public.group_join_requests
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ---------------------------------------------------------------------------
-- request_to_join_group
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.request_to_join_group(p_group_id uuid)
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

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
EXCEPTION
  WHEN unique_violation THEN
    -- Two concurrent requests: the partial unique index let only one through
    RETURN jsonb_build_object('success', false, 'error_code', 'JOIN_REQUEST_PENDING');
END;
$$;

-- ---------------------------------------------------------------------------
-- accept_join_request
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.accept_join_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_request record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  SELECT r.id, r.group_id, r.requester_id, r.status, g.created_by, g.festival_id
  INTO v_request
  FROM public.group_join_requests r
  JOIN public.groups g ON g.id = r.group_id
  WHERE r.id = p_request_id
  FOR UPDATE OF r;

  IF NOT FOUND OR v_request.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOIN_REQUEST_NOT_FOUND');
  END IF;

  IF v_request.created_by IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_GROUP_CREATOR');
  END IF;

  -- The requester may have joined through an invite link in the meantime
  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_request.group_id, v_request.requester_id)
  ON CONFLICT (user_id, group_id) DO NOTHING;

  UPDATE public.group_join_requests
  SET status = 'accepted', responded_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'group_id', v_request.group_id,
    'requester_id', v_request.requester_id,
    'festival_id', v_request.festival_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- decline_join_request
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.decline_join_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_request record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  SELECT r.id, r.group_id, r.status, g.created_by
  INTO v_request
  FROM public.group_join_requests r
  JOIN public.groups g ON g.id = r.group_id
  WHERE r.id = p_request_id
  FOR UPDATE OF r;

  IF NOT FOUND OR v_request.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'JOIN_REQUEST_NOT_FOUND');
  END IF;

  IF v_request.created_by IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_GROUP_CREATOR');
  END IF;

  UPDATE public.group_join_requests
  SET status = 'declined', responded_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', p_request_id, 'group_id', v_request.group_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- cancel_join_request: the requester withdraws their own pending request
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.cancel_join_request(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED');
  END IF;

  DELETE FROM public.group_join_requests
  WHERE group_id = p_group_id
    AND requester_id = v_user_id
    AND status = 'pending';

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.request_to_join_group(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_join_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decline_join_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_join_request(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.request_to_join_group(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_join_request(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_join_request(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_join_request(uuid) TO authenticated, service_role;
