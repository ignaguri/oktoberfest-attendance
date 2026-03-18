-- =====================================================
-- Add Friendship System
-- =====================================================
-- Adds a mutual friendship system with request/accept flow.
-- Friends get cross-group visibility into each other's
-- activity, photos, and location.
-- =====================================================

-- 1. Create friendship status enum
DO $$ BEGIN
  CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id),
  CHECK(requester_id != addressee_id)
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_friendships_requester
  ON public.friendships(requester_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_addressee
  ON public.friendships(addressee_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_accepted
  ON public.friendships(status) WHERE status = 'accepted';

-- 4. Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- 5. Helper function: check if two users are friends
-- Restricted to authenticated role only; caller must be one of the two users
CREATE OR REPLACE FUNCTION public.is_friend(user1 uuid, user2 uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Prevent probing arbitrary pairs: caller must be one of the users
  IF auth.uid() IS NULL OR (auth.uid() != user1 AND auth.uid() != user2) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
    AND (
      (requester_id = user1 AND addressee_id = user2)
      OR (requester_id = user2 AND addressee_id = user1)
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_friend(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_friend(uuid, uuid) TO authenticated;

-- 6. RLS Policies for friendships table

-- SELECT: Can see friendships you're part of
CREATE POLICY "Users can view own friendships"
  ON public.friendships FOR SELECT TO authenticated
  USING (
    requester_id = (SELECT auth.uid())
    OR addressee_id = (SELECT auth.uid())
  );

-- INSERT: Can only send requests as yourself
CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = (SELECT auth.uid())
  );

-- UPDATE: Only addressee can accept/decline
CREATE POLICY "Addressee can respond to friend requests"
  ON public.friendships FOR UPDATE TO authenticated
  USING (
    addressee_id = (SELECT auth.uid())
  )
  WITH CHECK (
    addressee_id = (SELECT auth.uid())
  );

-- DELETE: Either side can unfriend/cancel
CREATE POLICY "Users can remove friendships"
  ON public.friendships FOR DELETE TO authenticated
  USING (
    requester_id = (SELECT auth.uid())
    OR addressee_id = (SELECT auth.uid())
  );

-- Super admin override
CREATE POLICY "Super admins can do anything with friendships"
  ON public.friendships FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- 7. SECURITY DEFINER functions for API operations

-- Send friend request (handles duplicate/reverse checks)
CREATE OR REPLACE FUNCTION public.send_friend_request(
  p_requester_id uuid,
  p_addressee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF p_requester_id != auth.uid() THEN
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
$$;

-- Accept friend request
CREATE OR REPLACE FUNCTION public.accept_friend_request(
  p_friendship_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_friendship record;
BEGIN
  -- Prevent impersonation: caller must be the user
  IF p_user_id != auth.uid() THEN
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
$$;

-- Decline friend request
CREATE OR REPLACE FUNCTION public.decline_friend_request(
  p_friendship_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_friendship record;
BEGIN
  -- Prevent impersonation: caller must be the user
  IF p_user_id != auth.uid() THEN
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
$$;
