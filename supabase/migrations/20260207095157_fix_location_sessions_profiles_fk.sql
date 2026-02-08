-- Add foreign key from location_sessions.user_id to profiles.id
-- This enables PostgREST joins between location_sessions and profiles
-- (the existing FK to auth.users is kept for cascade deletes)
ALTER TABLE "public"."location_sessions"
  ADD CONSTRAINT "location_sessions_user_id_profiles_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");
