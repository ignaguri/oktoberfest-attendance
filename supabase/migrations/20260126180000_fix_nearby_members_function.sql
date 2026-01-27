-- Fix get_nearby_group_members to use location_sessions and location_points tables
-- instead of the non-existent user_locations table

-- Drop and recreate function: updated to use location_sessions/location_points
-- tables and added auth.uid() validation for security
DROP FUNCTION IF EXISTS public.get_nearby_group_members(uuid, uuid, integer);

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
  -- Enforce that the caller is querying their own data
  IF input_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: input_user_id must match authenticated user';
  END IF;

  -- Get user's current location from their active session
  SELECT lp.latitude, lp.longitude INTO user_lat, user_lng
  FROM public.location_sessions ls
  JOIN public.location_points lp ON lp.session_id = ls.id
  WHERE ls.user_id = input_user_id
    AND ls.festival_id = input_festival_id
    AND ls.is_active = true
    AND ls.expires_at > NOW()
  ORDER BY lp.recorded_at DESC
  LIMIT 1;

  -- If user has no active location, return empty result
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
  WHERE ls.festival_id = input_festival_id
    AND ls.is_active = true
    AND ls.expires_at > NOW()
    AND ls.user_id != input_user_id
    -- Get only the latest point for each session
    AND lp.recorded_at = (SELECT MAX(lp2.recorded_at) FROM public.location_points lp2 WHERE lp2.session_id = ls.id)
    -- Filter by radius using Haversine formula
    AND (6371000 * acos(LEAST(1.0, GREATEST(-1.0,
        cos(radians(user_lat)) * cos(radians(lp.latitude)) *
        cos(radians(lp.longitude) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(lp.latitude))
      )))) <= radius_meters
    -- Only include users who share at least one group with the current user
    AND EXISTS (SELECT 1 FROM public.group_members gm1
                JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id
                WHERE gm1.user_id = ls.user_id AND gm2.user_id = input_user_id)
  ORDER BY distance_meters;
END;
$$;

COMMENT ON FUNCTION public.get_nearby_group_members(uuid, uuid, integer) IS
'Returns nearby group members who are actively sharing their location. Validates input_user_id matches auth.uid() to prevent unauthorized access.';
