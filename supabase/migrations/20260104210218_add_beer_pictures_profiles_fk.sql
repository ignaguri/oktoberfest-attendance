-- Add foreign key from beer_pictures.user_id to profiles.id
-- This enables Supabase PostgREST to join beer_pictures with profiles

ALTER TABLE public.beer_pictures
ADD CONSTRAINT beer_pictures_user_id_profiles_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;
