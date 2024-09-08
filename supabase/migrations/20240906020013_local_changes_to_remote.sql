DROP FUNCTION IF EXISTS public.join_group(uuid, character varying, character varying);
CREATE OR REPLACE FUNCTION public.join_group(
    p_user_id uuid, 
    p_group_name character varying, 
    p_password character varying
) 
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_group_id UUID;
BEGIN
  -- Check if the group exists and the password is correct
  SELECT id INTO v_group_id
  FROM groups
  WHERE name = p_group_name AND password = p_password;
  
  IF v_group_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Add the user to the group
  INSERT INTO group_members (user_id, group_id)
  VALUES (p_user_id, v_group_id)
  ON CONFLICT (user_id, group_id) DO NOTHING;
  
  RETURN v_group_id;
END;
$function$
;

DROP VIEW IF EXISTS public.leaderboard;
create or replace view "public"."leaderboard" as  
SELECT 
    u.id AS user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    g.id AS group_id,
    g.name AS group_name,
    count(DISTINCT a.date) AS days_attended,
    COALESCE(avg(a.beer_count), (0)::numeric) AS avg_beers,
    COALESCE(sum(a.beer_count), (0)::bigint) AS total_beers
FROM 
    auth.users u
    JOIN group_members gm ON u.id = gm.user_id
    JOIN groups g ON gm.group_id = g.id
    LEFT JOIN attendances a ON u.id = a.user_id AND g.id = a.group_id
    JOIN profiles p ON u.id = p.id
WHERE 
    EXISTS (
        SELECT 1
        FROM group_members
        WHERE group_members.group_id = g.id 
        AND group_members.user_id = (select auth.uid())
    )
GROUP BY 
    u.id, p.username, p.full_name, p.avatar_url, g.id, g.name;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can delete own attendance" ON "public"."attendances";
DROP POLICY IF EXISTS "Users can insert own attendance" ON "public"."attendances";
DROP POLICY IF EXISTS "Users can update own attendance" ON "public"."attendances";
DROP POLICY IF EXISTS "Users can view own and group members' attendance" ON "public"."attendances";
DROP POLICY IF EXISTS "Users can join groups" ON "public"."group_members";
DROP POLICY IF EXISTS "Users can leave groups" ON "public"."group_members";
DROP POLICY IF EXISTS "Users can view group memberships they are part of" ON "public"."group_members";
DROP POLICY IF EXISTS "Group creators can update their groups" ON "public"."groups";
DROP POLICY IF EXISTS "Users can create groups" ON "public"."groups";
DROP POLICY IF EXISTS "Users can view groups they are members of" ON "public"."groups";

-- Recreate policies
create policy "Users can delete own attendance"
on "public"."attendances"
as permissive
for delete
to public
using (((select auth.uid()) = user_id));


create policy "Users can insert own attendance"
on "public"."attendances"
as permissive
for insert
to public
with check (((select auth.uid()) = user_id));


create policy "Users can update own attendance"
on "public"."attendances"
as permissive
for update
to public
using (((select auth.uid()) = user_id));


create policy "Users can view own and group members' attendance"
on "public"."attendances"
as permissive
for select
to public
using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = attendances.group_id) AND (group_members.user_id = (select auth.uid())))))));


create policy "Users can join groups"
on "public"."group_members"
as permissive
for insert
to public
with check ((user_id = (select auth.uid())));


create policy "Users can leave groups"
on "public"."group_members"
as permissive
for delete
to public
using ((user_id = (select auth.uid())));


create policy "Users can view group memberships they are part of"
on "public"."group_members"
as permissive
for select
to public
using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = group_members.group_id) AND (gm.user_id = (select auth.uid())))))));


create policy "Group creators can update their groups"
on "public"."groups"
as permissive
for update
to public
using (((select auth.uid()) = created_by));


create policy "Users can create groups"
on "public"."groups"
as permissive
for insert
to public
with check (((select auth.uid()) = created_by));


create policy "Users can view groups they are members of"
on "public"."groups"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = groups.id) AND (group_members.user_id = (select auth.uid()))))));
