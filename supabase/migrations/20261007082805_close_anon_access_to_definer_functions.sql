-- The friend-request functions guarded with `p_user_id != auth.uid()`. For anon
-- auth.uid() is NULL, the comparison is NULL and the guard never fired, so an
-- unauthenticated caller could send or answer requests as anyone. Fix the
-- guard, and take EXECUTE away from anon as well: the API only calls these
-- with a user's token.
CREATE OR REPLACE FUNCTION public.send_friend_request(p_requester_id uuid, p_addressee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing record;
  v_friendship_id uuid;
BEGIN
  -- Validate inputs
  IF p_requester_id IS NULL OR p_addressee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_INPUT',
      'message', 'User IDs cannot be null'
    );
  END IF;

  -- Prevent impersonation: caller must be the requester
  IF p_requester_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'FORBIDDEN',
      'message', 'Cannot send requests on behalf of other users'
    );
  END IF;

  IF p_requester_id = p_addressee_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'SELF_REQUEST',
      'message', 'Cannot send a friend request to yourself'
    );
  END IF;

  -- Check for existing friendship in either direction
  SELECT id, status, requester_id, addressee_id
  INTO v_existing
  FROM public.friendships
  WHERE (requester_id = p_requester_id AND addressee_id = p_addressee_id)
     OR (requester_id = p_addressee_id AND addressee_id = p_requester_id);

  IF v_existing IS NOT NULL THEN
    IF v_existing.status = 'accepted' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'ALREADY_FRIENDS',
        'message', 'You are already friends'
      );
    END IF;

    IF v_existing.status = 'pending' THEN
      -- If the other user already sent us a request, auto-accept
      IF v_existing.requester_id = p_addressee_id THEN
        UPDATE public.friendships
        SET status = 'accepted', updated_at = now()
        WHERE id = v_existing.id;

        RETURN jsonb_build_object(
          'success', true,
          'friendship_id', v_existing.id,
          'status', 'accepted',
          'message', 'Friend request accepted (mutual request)'
        );
      END IF;

      -- User already sent a pending request
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'ALREADY_PENDING',
        'message', 'Friend request already sent'
      );
    END IF;

    -- If previously declined, allow re-requesting by updating
    IF v_existing.status = 'declined' THEN
      IF v_existing.requester_id = p_requester_id THEN
        UPDATE public.friendships
        SET status = 'pending', updated_at = now()
        WHERE id = v_existing.id;

        RETURN jsonb_build_object(
          'success', true,
          'friendship_id', v_existing.id,
          'status', 'pending',
          'message', 'Friend request sent'
        );
      ELSE
        -- The other person declined our previous request from the other side,
        -- create a new one in the opposite direction
        DELETE FROM public.friendships WHERE id = v_existing.id;
      END IF;
    END IF;
  END IF;

  -- Insert new friend request
  INSERT INTO public.friendships (requester_id, addressee_id, status)
  VALUES (p_requester_id, p_addressee_id, 'pending')
  RETURNING id INTO v_friendship_id;

  RETURN jsonb_build_object(
    'success', true,
    'friendship_id', v_friendship_id,
    'status', 'pending',
    'message', 'Friend request sent'
  );
END;
$function$

;
CREATE OR REPLACE FUNCTION public.accept_friend_request(p_friendship_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_friendship record;
BEGIN
  -- Prevent impersonation: caller must be the user
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'FORBIDDEN',
      'message', 'Cannot accept requests on behalf of other users'
    );
  END IF;

  SELECT id, requester_id, addressee_id, status
  INTO v_friendship
  FROM public.friendships
  WHERE id = p_friendship_id;

  IF v_friendship IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'NOT_FOUND',
      'message', 'Friend request not found'
    );
  END IF;

  IF v_friendship.addressee_id != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'FORBIDDEN',
      'message', 'Only the addressee can accept this request'
    );
  END IF;

  IF v_friendship.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_STATUS',
      'message', 'This request is not pending'
    );
  END IF;

  UPDATE public.friendships
  SET status = 'accepted', updated_at = now()
  WHERE id = p_friendship_id;

  RETURN jsonb_build_object(
    'success', true,
    'friendship_id', p_friendship_id,
    'status', 'accepted',
    'message', 'Friend request accepted'
  );
END;
$function$

;
CREATE OR REPLACE FUNCTION public.decline_friend_request(p_friendship_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_friendship record;
BEGIN
  -- Prevent impersonation: caller must be the user
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'FORBIDDEN',
      'message', 'Cannot decline requests on behalf of other users'
    );
  END IF;

  SELECT id, requester_id, addressee_id, status
  INTO v_friendship
  FROM public.friendships
  WHERE id = p_friendship_id;

  IF v_friendship IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'NOT_FOUND',
      'message', 'Friend request not found'
    );
  END IF;

  IF v_friendship.addressee_id != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'FORBIDDEN',
      'message', 'Only the addressee can decline this request'
    );
  END IF;

  IF v_friendship.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_STATUS',
      'message', 'This request is not pending'
    );
  END IF;

  UPDATE public.friendships
  SET status = 'declined', updated_at = now()
  WHERE id = p_friendship_id;

  RETURN jsonb_build_object(
    'success', true,
    'friendship_id', p_friendship_id,
    'status', 'declined',
    'message', 'Friend request declined'
  );
END;
$function$

;

REVOKE EXECUTE ON FUNCTION public.send_friend_request(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.accept_friend_request(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.decline_friend_request(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_friend_request(uuid, uuid) TO authenticated, service_role;

-- Already guarded on auth.uid(), but neither should be callable without a session
REVOKE EXECUTE ON FUNCTION public.get_nearby_group_members(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_nearby_group_members(uuid, uuid, integer) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_user_groups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_groups() TO authenticated, service_role;

-- Trigger functions are never meant to be called over RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_notification_preferences() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_achievement_event_from_unlock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_achievement_cache_invalidation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_tent_visit_cache_invalidation() FROM PUBLIC, anon, authenticated;

-- Both views ran as their owner, so anyone could read every user's festival
-- stats and spending. The API reads them with a user's token only.
REVOKE ALL ON public.user_festival_stats FROM anon;
REVOKE ALL ON public.user_festival_spending_stats FROM anon;
GRANT SELECT ON public.user_festival_stats TO authenticated, service_role;
GRANT SELECT ON public.user_festival_spending_stats TO authenticated, service_role;

-- Both now follow RLS. A viewer sees another user's attendances and
-- consumptions under the same rule (own, friend or shared group), so other
-- users' profile history gets the same totals it did before.
ALTER VIEW public.user_festival_stats SET (security_invoker = true);
ALTER VIEW public.user_festival_spending_stats SET (security_invoker = true);
