-- Make deleting an account from the admin panel actually work.
--
-- `auth.admin.deleteUser` issues a plain DELETE on auth.users as the
-- `supabase_auth_admin` role, and two separate things made that fail with
-- GoTrue's opaque "Database error deleting user" (surfaced as a 500). Both
-- admin panels call the same endpoint, so this was broken on web and mobile
-- alike; `SupabaseAdminRepository.deleteUser` already documented a cascade it
-- was not getting.
--
-- 1. Foreign keys with nowhere to go
--
--    profiles.id            -> auth.users   NO ACTION  (every user has a
--                                                       profile, so this alone
--                                                       blocked every deletion)
--    beer_pictures.user_id  -> auth.users   NO ACTION
--    groups.created_by      -> auth.users   NO ACTION
--    tent_visits.user_id    -> profiles     NO ACTION  (blocks the profile row
--                                                       once it does cascade)
--
--    Cascade is right for the three rows that belong to the user. `groups` is
--    not one of them: a group outlives whoever created it and its other members
--    still need it, so created_by (already nullable) is set to null instead.
--
-- 2. Cache-invalidation triggers that cannot run as `supabase_auth_admin`
--
--    The triggers on attendances, tent_visits and user_achievements call
--    `invalidate_wrapped_cache(...)`, which deletes from wrapped_data_cache.
--    Under the auth role that failed twice over: first "function
--    invalidate_wrapped_cache(uuid, uuid) does not exist" (the role runs with
--    `search_path=auth` and these functions pin no search_path of their own),
--    then "permission denied for table wrapped_data_cache" (it has no grants in
--    `public`).
--
--    So they become SECURITY DEFINER with a pinned search_path, the same shape
--    as the functions in 20260805150000_harden_security_definer_grants. That is
--    not an escalation surface: a plpgsql trigger function refuses to run when
--    called any other way, and cache invalidation is exactly the kind of
--    bookkeeping that should not depend on who happened to touch the row.
--
--    `invalidate_wrapped_cache` itself stays SECURITY INVOKER on purpose --
--    wrapped.repository.ts calls it over RPC on the caller's own client, and as
--    a definer it would let anyone drop anyone else's cached Wrapped. Inside
--    these triggers it inherits their privileges, which is all it needed.

-- 1. Foreign keys

alter table "public"."profiles"
  drop constraint "profiles_id_fkey",
  add constraint "profiles_id_fkey"
    foreign key ("id") references "auth"."users"("id") on delete cascade;

alter table "public"."beer_pictures"
  drop constraint "beer_pictures_user_id_fkey",
  add constraint "beer_pictures_user_id_fkey"
    foreign key ("user_id") references "auth"."users"("id") on delete cascade;

alter table "public"."groups"
  drop constraint "groups_created_by_fkey",
  add constraint "groups_created_by_fkey"
    foreign key ("created_by") references "auth"."users"("id") on delete set null;

alter table "public"."tent_visits"
  drop constraint "tent_visits_user_id_fkey",
  add constraint "tent_visits_user_id_fkey"
    foreign key ("user_id") references "public"."profiles"("id") on delete cascade;

-- 2. The cache-invalidation triggers

alter function "public"."trigger_wrapped_cache_invalidation"()
  security definer set search_path to 'public';
alter function "public"."trigger_tent_visit_cache_invalidation"()
  security definer set search_path to 'public';
alter function "public"."trigger_achievement_cache_invalidation"()
  security definer set search_path to 'public';
