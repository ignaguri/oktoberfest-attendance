create table "public"."attendances" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid,
    "group_id" uuid,
    "date" date not null,
    "beer_count" integer not null default 0,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP
);


alter table "public"."attendances" enable row level security;

create table "public"."group_members" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid,
    "group_id" uuid,
    "joined_at" timestamp with time zone default CURRENT_TIMESTAMP
);


alter table "public"."group_members" enable row level security;

create table "public"."groups" (
    "id" uuid not null default uuid_generate_v4(),
    "name" character varying(255) not null,
    "password" character varying(255) not null,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "created_by" uuid
);


alter table "public"."groups" enable row level security;

CREATE UNIQUE INDEX attendances_pkey ON public.attendances USING btree (id);

CREATE UNIQUE INDEX attendances_user_id_group_id_date_key ON public.attendances USING btree (user_id, group_id, date);

CREATE UNIQUE INDEX group_members_pkey ON public.group_members USING btree (id);

CREATE UNIQUE INDEX group_members_user_id_group_id_key ON public.group_members USING btree (user_id, group_id);

CREATE UNIQUE INDEX groups_name_key ON public.groups USING btree (name);

CREATE UNIQUE INDEX groups_pkey ON public.groups USING btree (id);

CREATE INDEX idx_attendances_date ON public.attendances USING btree (date);

CREATE INDEX idx_attendances_group_id ON public.attendances USING btree (group_id);

CREATE INDEX idx_attendances_user_id ON public.attendances USING btree (user_id);

CREATE INDEX idx_group_members_group_id ON public.group_members USING btree (group_id);

CREATE INDEX idx_group_members_user_id ON public.group_members USING btree (user_id);

alter table "public"."attendances" add constraint "attendances_pkey" PRIMARY KEY using index "attendances_pkey";

alter table "public"."group_members" add constraint "group_members_pkey" PRIMARY KEY using index "group_members_pkey";

alter table "public"."groups" add constraint "groups_pkey" PRIMARY KEY using index "groups_pkey";

alter table "public"."attendances" add constraint "attendances_group_id_fkey" FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE not valid;

alter table "public"."attendances" validate constraint "attendances_group_id_fkey";

alter table "public"."attendances" add constraint "attendances_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."attendances" validate constraint "attendances_user_id_fkey";

alter table "public"."attendances" add constraint "attendances_user_id_group_id_date_key" UNIQUE using index "attendances_user_id_group_id_date_key";

alter table "public"."group_members" add constraint "group_members_group_id_fkey" FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE not valid;

alter table "public"."group_members" validate constraint "group_members_group_id_fkey";

alter table "public"."group_members" add constraint "group_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."group_members" validate constraint "group_members_user_id_fkey";

alter table "public"."group_members" add constraint "group_members_user_id_group_id_key" UNIQUE using index "group_members_user_id_group_id_key";

alter table "public"."groups" add constraint "groups_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."groups" validate constraint "groups_created_by_fkey";

alter table "public"."groups" add constraint "groups_name_key" UNIQUE using index "groups_name_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_user_groups()
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT group_id FROM group_members
  WHERE user_id = (select auth.uid());
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_group_member(group_id uuid, user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = $1
    AND group_members.user_id = $2
  );
END;
$function$
;

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


CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$function$
;

grant delete on table "public"."attendances" to "anon";

grant insert on table "public"."attendances" to "anon";

grant references on table "public"."attendances" to "anon";

grant select on table "public"."attendances" to "anon";

grant trigger on table "public"."attendances" to "anon";

grant truncate on table "public"."attendances" to "anon";

grant update on table "public"."attendances" to "anon";

grant delete on table "public"."attendances" to "authenticated";

grant insert on table "public"."attendances" to "authenticated";

grant references on table "public"."attendances" to "authenticated";

grant select on table "public"."attendances" to "authenticated";

grant trigger on table "public"."attendances" to "authenticated";

grant truncate on table "public"."attendances" to "authenticated";

grant update on table "public"."attendances" to "authenticated";

grant delete on table "public"."attendances" to "service_role";

grant insert on table "public"."attendances" to "service_role";

grant references on table "public"."attendances" to "service_role";

grant select on table "public"."attendances" to "service_role";

grant trigger on table "public"."attendances" to "service_role";

grant truncate on table "public"."attendances" to "service_role";

grant update on table "public"."attendances" to "service_role";

grant delete on table "public"."group_members" to "anon";

grant insert on table "public"."group_members" to "anon";

grant references on table "public"."group_members" to "anon";

grant select on table "public"."group_members" to "anon";

grant trigger on table "public"."group_members" to "anon";

grant truncate on table "public"."group_members" to "anon";

grant update on table "public"."group_members" to "anon";

grant delete on table "public"."group_members" to "authenticated";

grant insert on table "public"."group_members" to "authenticated";

grant references on table "public"."group_members" to "authenticated";

grant select on table "public"."group_members" to "authenticated";

grant trigger on table "public"."group_members" to "authenticated";

grant truncate on table "public"."group_members" to "authenticated";

grant update on table "public"."group_members" to "authenticated";

grant delete on table "public"."group_members" to "service_role";

grant insert on table "public"."group_members" to "service_role";

grant references on table "public"."group_members" to "service_role";

grant select on table "public"."group_members" to "service_role";

grant trigger on table "public"."group_members" to "service_role";

grant truncate on table "public"."group_members" to "service_role";

grant update on table "public"."group_members" to "service_role";

grant delete on table "public"."groups" to "anon";

grant insert on table "public"."groups" to "anon";

grant references on table "public"."groups" to "anon";

grant select on table "public"."groups" to "anon";

grant trigger on table "public"."groups" to "anon";

grant truncate on table "public"."groups" to "anon";

grant update on table "public"."groups" to "anon";

grant delete on table "public"."groups" to "authenticated";

grant insert on table "public"."groups" to "authenticated";

grant references on table "public"."groups" to "authenticated";

grant select on table "public"."groups" to "authenticated";

grant trigger on table "public"."groups" to "authenticated";

grant truncate on table "public"."groups" to "authenticated";

grant update on table "public"."groups" to "authenticated";

grant delete on table "public"."groups" to "service_role";

grant insert on table "public"."groups" to "service_role";

grant references on table "public"."groups" to "service_role";

grant select on table "public"."groups" to "service_role";

grant trigger on table "public"."groups" to "service_role";

grant truncate on table "public"."groups" to "service_role";

grant update on table "public"."groups" to "service_role";

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


CREATE TRIGGER update_attendances_updated_at BEFORE UPDATE ON public.attendances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


