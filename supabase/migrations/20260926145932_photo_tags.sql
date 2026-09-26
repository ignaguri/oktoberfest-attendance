-- Photo tags: the uploader names who is in a public photo. The tagged person
-- is notified, labelled on the photo, and gets it on their profile.
--
-- tagged_user_id references auth.users, not profiles: a composite-PK table
-- with FKs to two public tables becomes a PostgREST many-to-many junction and
-- breaks the gallery's beer_pictures -> profiles embed.
CREATE TABLE public.photo_tags (
  photo_id uuid NOT NULL REFERENCES public.beer_pictures(id) ON DELETE CASCADE,
  tagged_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (photo_id, tagged_user_id)
);

CREATE INDEX idx_photo_tags_tagged_user
  ON public.photo_tags (tagged_user_id, created_at DESC);

ALTER TABLE public.photo_tags ENABLE ROW LEVEL SECURITY;

-- Visible exactly when the photo is: the subquery runs under beer_pictures RLS.
CREATE POLICY "Tags are visible with their photo"
  ON public.photo_tags FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.beer_pictures p WHERE p.id = photo_tags.photo_id)
  );

CREATE POLICY "Uploaders tag their public photos"
  ON public.photo_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.beer_pictures p
      WHERE p.id = photo_tags.photo_id
        AND p.user_id = (SELECT auth.uid())
        AND p.visibility = 'public'::photo_visibility_enum
    )
  );

CREATE POLICY "Uploaders untag their photos"
  ON public.photo_tags FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.beer_pictures p
      WHERE p.id = photo_tags.photo_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

-- Supabase grants new tables to anon/authenticated directly, so revoke by name.
REVOKE ALL ON public.photo_tags FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.photo_tags TO authenticated;
GRANT ALL ON public.photo_tags TO service_role;
