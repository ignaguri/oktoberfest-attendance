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
