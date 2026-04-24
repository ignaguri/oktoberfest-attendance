-- Festival-scope the shared-group visibility check in get_nearby_group_members.
--
-- Previously the EXISTS shared-group subquery joined two group_members rows
-- without consulting groups.festival_id, so two users sharing any group at all
-- could see each other's location across festivals. Repro: user3 viewing a
-- session on festival A could see user4's session on festival B because both
-- belonged to "Test Group C" on festival A. Groups are festival-scoped
-- (groups.festival_id is NOT NULL); the visibility check now matches.
--
-- Body is otherwise identical to 20260423130000_nearby_members_friend_left_join.sql.

CREATE OR REPLACE FUNCTION public.get_nearby_group_members(
  input_user_id uuid,
  input_festival_id uuid,
  radius_meters integer DEFAULT 1000
)
RETURNS TABLE (
  user_id uuid,
  username text,
  full_name text,
  avatar_url text,
  session_id uuid,
  latitude double precision,
  longitude double precision,
  distance_meters double precision,
  last_updated timestamptz,
  group_names text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_lat double precision;
  user_lng double precision;
BEGIN
  IF auth.uid() IS NULL OR input_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied: input_user_id must match authenticated user';
  END IF;

  SELECT lp.latitude, lp.longitude INTO user_lat, user_lng
  FROM public.location_sessions ls
  JOIN public.location_points lp ON lp.session_id = ls.id
  WHERE ls.user_id = input_user_id
    AND ls.festival_id = input_festival_id
    AND ls.is_active = true
    AND ls.expires_at > NOW()
  ORDER BY lp.recorded_at DESC
  LIMIT 1;

  IF user_lat IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ls.user_id::uuid,
    p.username::text,
    p.full_name::text,
    p.avatar_url::text,
    ls.id::uuid AS session_id,
    lp.latitude::double precision,
    lp.longitude::double precision,
    (6371000 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(user_lat)) * cos(radians(lp.latitude)) *
        cos(radians(lp.longitude) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(lp.latitude))
      ))
    ))::double precision AS distance_meters,
    lp.recorded_at::timestamptz AS last_updated,
    COALESCE(
      (SELECT array_agg(DISTINCT g.name)::text[]
       FROM public.group_members gm
       JOIN public.groups g ON g.id = gm.group_id
       WHERE gm.user_id = ls.user_id
         AND g.festival_id = input_festival_id
         AND EXISTS (SELECT 1 FROM public.group_members gm2
                     WHERE gm2.group_id = gm.group_id AND gm2.user_id = input_user_id)),
      ARRAY[]::text[]
    ) AS group_names
  FROM public.location_sessions ls
  JOIN public.location_points lp ON lp.session_id = ls.id
  JOIN public.profiles p ON p.id = ls.user_id
  LEFT JOIN public.friendships f
    ON f.status = 'accepted'
    AND ls.share_with_friends = true
    AND (
      (f.requester_id = input_user_id AND f.addressee_id = ls.user_id)
      OR (f.requester_id = ls.user_id AND f.addressee_id = input_user_id)
    )
  WHERE ls.festival_id = input_festival_id
    AND ls.is_active = true
    AND ls.expires_at > NOW()
    AND ls.user_id != input_user_id
    AND lp.recorded_at = (SELECT MAX(lp2.recorded_at) FROM public.location_points lp2 WHERE lp2.session_id = ls.id)
    AND (6371000 * acos(LEAST(1.0, GREATEST(-1.0,
        cos(radians(user_lat)) * cos(radians(lp.latitude)) *
        cos(radians(lp.longitude) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(lp.latitude))
      )))) <= radius_meters
    -- Visibility: shared group on the SAME festival, OR friends-with-opt-in.
    AND (
      EXISTS (
        SELECT 1
        FROM public.group_members gm1
        JOIN public.groups g ON g.id = gm1.group_id
        JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id
        WHERE gm1.user_id = ls.user_id
          AND gm2.user_id = input_user_id
          AND g.festival_id = input_festival_id
      )
      OR f.id IS NOT NULL
    )
  ORDER BY distance_meters;
END;
$$;

COMMENT ON FUNCTION public.get_nearby_group_members(uuid, uuid, integer) IS
'Returns nearby users sharing location. Visibility is the UNION of (shared group on input_festival_id) and (ls.share_with_friends = true AND caller is an accepted friend of owner). Validates input_user_id matches auth.uid() to prevent unauthorized access.';
