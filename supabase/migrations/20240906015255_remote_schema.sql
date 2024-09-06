drop policy "Users can delete own attendance" on "public"."attendances";

drop policy "Users can insert own attendance" on "public"."attendances";

drop policy "Users can update own attendance" on "public"."attendances";

drop policy "Users can view own and group members' attendance" on "public"."attendances";

drop policy "Users can join groups" on "public"."group_members";

drop policy "Users can leave groups" on "public"."group_members";

drop policy "Group creators can update their groups" on "public"."groups";

drop policy "Users can create groups" on "public"."groups";

drop policy "Users can view groups they are members of" on "public"."groups";

drop view if exists "public"."leaderboard";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_user_groups()
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT group_id FROM group_members
  WHERE user_id = auth.uid();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.join_group(p_user_id uuid, p_group_name character varying, p_password character varying)
 RETURNS boolean
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
    RETURN FALSE;
  END IF;
  
  -- Add the user to the group
  INSERT INTO group_members (user_id, group_id)
  VALUES (p_user_id, v_group_id)
  ON CONFLICT (user_id, group_id) DO NOTHING;
  
  RETURN TRUE;
END;
$function$
;

create or replace view "public"."leaderboard" as  SELECT u.id AS user_id,
    u.email,
    g.id AS group_id,
    g.name AS group_name,
    count(DISTINCT a.date) AS days_attended,
    COALESCE(avg(a.beer_count), (0)::numeric) AS avg_beers,
    COALESCE(sum(a.beer_count), (0)::bigint) AS total_beers
   FROM (((auth.users u
     JOIN group_members gm ON ((u.id = gm.user_id)))
     JOIN groups g ON ((gm.group_id = g.id)))
     LEFT JOIN attendances a ON (((u.id = a.user_id) AND (g.id = a.group_id))))
  WHERE (EXISTS ( SELECT 1
           FROM group_members
          WHERE ((group_members.group_id = g.id) AND (group_members.user_id = auth.uid()))))
  GROUP BY u.id, u.email, g.id, g.name;


create policy "Users can delete own attendance"
on "public"."attendances"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can insert own attendance"
on "public"."attendances"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can update own attendance"
on "public"."attendances"
as permissive
for update
to public
using ((auth.uid() = user_id));


create policy "Users can view own and group members' attendance"
on "public"."attendances"
as permissive
for select
to public
using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = attendances.group_id) AND (group_members.user_id = auth.uid()))))));


create policy "Users can join groups"
on "public"."group_members"
as permissive
for insert
to public
with check ((user_id = auth.uid()));


create policy "Users can leave groups"
on "public"."group_members"
as permissive
for delete
to public
using ((user_id = auth.uid()));


create policy "Group creators can update their groups"
on "public"."groups"
as permissive
for update
to public
using ((auth.uid() = created_by));


create policy "Users can create groups"
on "public"."groups"
as permissive
for insert
to public
with check ((auth.uid() = created_by));


create policy "Users can view groups they are members of"
on "public"."groups"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = groups.id) AND (group_members.user_id = auth.uid())))));



