-- Close direct table access that let anyone read or join any group.
--
-- Apply only after the API that uses 20261006181502's functions is deployed:
-- the previous API reads groups by token and inserts memberships directly.
--
-- 1. "Users can view groups by invite token" (20260104220100) had no TO clause
--    and USING (invite_token IS NOT NULL), so whole rows, invite_token and
--    password included, were readable with the anon key.
DROP POLICY IF EXISTS "Users can view groups by invite token" ON public.groups;

-- 2. "Users can join groups" only checked user_id = auth.uid(), so any signed-in
--    user could insert themselves into any group without a token. Every join
--    path now goes through a SECURITY DEFINER function (join_group_with_token,
--    accept_group_invitation, accept_join_request, create_group_with_member).
DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;

-- 3. Name + password join. Unused by the app, and every password has been
--    readable through (1), so it is a join-anything door.
DROP FUNCTION IF EXISTS public.join_group(uuid, character varying, character varying, uuid);

-- 4. search_groups is callable over PostgREST without the API's schema, and a
--    blank name matches every group. Same function with that guarded.
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
  WHERE length(btrim(coalesce(p_name, ''))) > 0
    AND g.name ILIKE '%' || replace(replace(replace(p_name, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    AND (p_festival_id IS NULL OR g.festival_id = p_festival_id)
  ORDER BY g.name
  LIMIT least(greatest(coalesce(p_limit, 10), 1), 50);
$function$;
