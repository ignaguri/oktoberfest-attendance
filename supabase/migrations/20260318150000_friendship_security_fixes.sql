-- =====================================================
-- Friendship Security Fixes
-- =====================================================
-- 1. Add auth.uid() validation to SECURITY DEFINER functions
-- 2. Add unordered pair uniqueness constraint
-- 3. Fix activity_feed CROSS JOIN for friend visibility
-- =====================================================

-- =====================================================
-- 1. SECURITY DEFINER: Validate auth.uid() in all functions
-- =====================================================

-- send_friend_request: add auth.uid() guard
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

-- accept_friend_request: add auth.uid() guard
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

-- decline_friend_request: add auth.uid() guard
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

-- =====================================================
-- 1b. Restrict is_friend() to prevent probing arbitrary pairs
-- =====================================================
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

-- =====================================================
-- 2. Unordered pair uniqueness constraint
-- =====================================================
-- Prevents both (A→B) and (B→A) rows from existing simultaneously.
-- First, deduplicate any reverse-duplicate pairs that may have been created
-- before this constraint existed. Keep the accepted row (or the newer one if tied).
DELETE FROM public.friendships f1
USING public.friendships f2
WHERE f1.requester_id = f2.addressee_id
  AND f1.addressee_id = f2.requester_id
  AND f1.id != f2.id
  AND (
    -- Keep accepted over non-accepted
    (f2.status = 'accepted' AND f1.status != 'accepted')
    OR
    -- If same status, keep the newer one (higher id)
    (f2.status = f1.status AND f1.created_at < f2.created_at)
    OR
    -- Tiebreaker: keep the row with the lower id
    (f2.status = f1.status AND f1.created_at = f2.created_at AND f1.id > f2.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_unique_pair
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

-- =====================================================
-- 3. Fix activity_feed: replace CROSS JOIN with actual activity join
-- =====================================================
DROP VIEW IF EXISTS public.activity_feed;

CREATE VIEW public.activity_feed
WITH (security_invoker = true)
AS
WITH user_group_members AS (
  SELECT DISTINCT gm2.user_id,
    gm2.group_id,
    g.festival_id
  FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    JOIN groups g ON g.id = gm1.group_id
  WHERE gm1.user_id = auth.uid() AND gm2.user_id <> auth.uid()
),
user_friends AS (
  SELECT
    CASE
      WHEN f.requester_id = auth.uid() THEN f.addressee_id
      ELSE f.requester_id
    END AS user_id
  FROM friendships f
  WHERE f.status = 'accepted'
  AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
),
visible_users AS (
  SELECT DISTINCT user_id, festival_id FROM user_group_members
  UNION
  SELECT DISTINCT uf.user_id, a.festival_id
  FROM user_friends uf
  JOIN attendances a ON a.user_id = uf.user_id
),
recent_attendances AS (
  SELECT a.user_id,
    a.festival_id,
    'beer_count_update'::activity_type_enum AS activity_type,
    jsonb_build_object('beer_count', a.beer_count, 'date', a.date, 'attendance_id', a.id) AS activity_data,
    GREATEST(a.created_at, a.updated_at) AS activity_time,
    a.created_at,
    a.updated_at
  FROM attendances a
    JOIN visible_users vu ON vu.user_id = a.user_id AND vu.festival_id = a.festival_id
  WHERE GREATEST(a.created_at, a.updated_at) > (now() - '48:00:00'::interval)
),
recent_tent_visits AS (
  SELECT tv.user_id,
    tv.festival_id,
    'tent_checkin'::activity_type_enum AS activity_type,
    jsonb_build_object('tent_id', tv.tent_id, 'tent_name', t.name, 'visit_date', tv.visit_date) AS activity_data,
    tv.visit_date AS activity_time,
    tv.visit_date AS created_at,
    tv.visit_date AS updated_at
  FROM tent_visits tv
    JOIN tents t ON t.id = tv.tent_id
    JOIN visible_users vu ON vu.user_id = tv.user_id AND vu.festival_id = tv.festival_id
  WHERE tv.visit_date > (now() - '48:00:00'::interval)
),
recent_photos AS (
  SELECT bp.user_id,
    a.festival_id,
    'photo_upload'::activity_type_enum AS activity_type,
    jsonb_build_object('picture_url', bp.picture_url, 'attendance_id', bp.attendance_id, 'date', a.date) AS activity_data,
    bp.created_at AS activity_time,
    bp.created_at,
    bp.created_at AS updated_at
  FROM beer_pictures bp
    JOIN attendances a ON a.id = bp.attendance_id
    JOIN visible_users vu ON vu.user_id = bp.user_id AND vu.festival_id = a.festival_id
  WHERE bp.created_at > (now() - '48:00:00'::interval)
    AND bp.visibility = 'public'::photo_visibility_enum
),
recent_group_joins AS (
  SELECT gm.user_id,
    g.festival_id,
    'group_join'::activity_type_enum AS activity_type,
    jsonb_build_object('group_id', g.id, 'group_name', g.name) AS activity_data,
    gm.joined_at AS activity_time,
    gm.joined_at AS created_at,
    gm.joined_at AS updated_at
  FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    JOIN visible_users vu ON vu.user_id = gm.user_id AND vu.festival_id = g.festival_id
  WHERE gm.joined_at > (now() - '48:00:00'::interval)
),
recent_achievements AS (
  SELECT ua.user_id,
    ua.festival_id,
    'achievement_unlock'::activity_type_enum AS activity_type,
    jsonb_build_object('achievement_id', ua.achievement_id, 'achievement_name', a.name, 'achievement_icon', a.icon, 'rarity', a.rarity) AS activity_data,
    ua.unlocked_at AS activity_time,
    ua.unlocked_at AS created_at,
    ua.unlocked_at AS updated_at
  FROM user_achievements ua
    JOIN achievements a ON a.id = ua.achievement_id
    JOIN visible_users vu ON vu.user_id = ua.user_id AND vu.festival_id = ua.festival_id
  WHERE ua.unlocked_at > (now() - '48:00:00'::interval)
),
all_activities AS (
  SELECT * FROM recent_attendances
  UNION ALL
  SELECT * FROM recent_tent_visits
  UNION ALL
  SELECT * FROM recent_photos
  UNION ALL
  SELECT * FROM recent_group_joins
  UNION ALL
  SELECT * FROM recent_achievements
)
SELECT
  aa.user_id,
  aa.festival_id,
  aa.activity_type,
  aa.activity_data,
  aa.activity_time,
  p.username,
  p.full_name,
  p.avatar_url
FROM all_activities aa
  JOIN profiles p ON p.id = aa.user_id
ORDER BY aa.activity_time DESC;

GRANT SELECT ON public.activity_feed TO authenticated;
