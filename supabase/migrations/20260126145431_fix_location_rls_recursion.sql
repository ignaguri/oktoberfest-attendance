-- Fix infinite recursion in location_sessions and location_session_members RLS policies
-- The circular dependency was:
--   location_sessions -> location_session_members -> location_sessions

-- Create a SECURITY DEFINER function to check session ownership (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_owns_location_session(session_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.location_sessions
    WHERE id = session_uuid AND user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.user_owns_location_session(uuid) IS
'SECURITY DEFINER function that intentionally bypasses RLS to check if the current user (auth.uid()) owns a location session. This is necessary to break the RLS recursion between location_sessions and location_session_members/location_points tables. The function is safe because it only checks ownership via auth.uid() and does not expose any data.';

-- Drop the problematic policy on location_session_members
DROP POLICY IF EXISTS "Users can manage own session members" ON public.location_session_members;

-- Recreate with the security definer function (no RLS recursion)
CREATE POLICY "Users can manage own session members"
ON public.location_session_members
FOR ALL
USING (public.user_owns_location_session(session_id))
WITH CHECK (public.user_owns_location_session(session_id));

-- Also fix the location_points policies that have similar issues
DROP POLICY IF EXISTS "Users can insert own location points" ON public.location_points;
DROP POLICY IF EXISTS "Users can view own location points" ON public.location_points;

CREATE POLICY "Users can insert own location points"
ON public.location_points
FOR INSERT
WITH CHECK (public.user_owns_location_session(session_id));

CREATE POLICY "Users can view own location points"
ON public.location_points
FOR SELECT
USING (public.user_owns_location_session(session_id));
