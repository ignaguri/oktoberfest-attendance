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

-- Same people the API offers: accepted friends, or group-mates in the photo's
-- festival. Enforced here too so a direct PostgREST insert cannot put a
-- stranger's name on a photo.
CREATE POLICY "Uploaders tag their public photos"
  ON public.photo_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.beer_pictures p
        JOIN public.attendances a ON a.id = p.attendance_id
      WHERE p.id = photo_tags.photo_id
        AND p.user_id = (SELECT auth.uid())
        AND p.visibility = 'public'::photo_visibility_enum
        -- The API rejects self-tags; a shared group would otherwise let one through
        AND photo_tags.tagged_user_id <> (SELECT auth.uid())
        AND (
          public.is_friend((SELECT auth.uid()), photo_tags.tagged_user_id)
          OR EXISTS (
            SELECT 1 FROM public.v_user_shared_group_members v
            WHERE v.viewer_id = (SELECT auth.uid())
              AND v.owner_id = photo_tags.tagged_user_id
              AND v.festival_id = a.festival_id
          )
        )
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

-- Replaces a photo's tag set in one statement, so a failed insert never leaves
-- the old tags deleted. Runs as the caller, so the policies above still decide
-- who may be tagged. Returns only the rows it actually inserted, which is who
-- gets notified, even when two edits race.
CREATE FUNCTION public.set_photo_tags(p_photo_id uuid, p_user_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH removed AS (
    DELETE FROM public.photo_tags
    WHERE photo_id = p_photo_id AND tagged_user_id <> ALL (p_user_ids)
  ),
  added AS (
    INSERT INTO public.photo_tags (photo_id, tagged_user_id)
    SELECT p_photo_id, user_id FROM unnest(p_user_ids) AS user_id
    ON CONFLICT (photo_id, tagged_user_id) DO NOTHING
    RETURNING tagged_user_id
  )
  SELECT tagged_user_id FROM added
$$;
REVOKE ALL ON FUNCTION public.set_photo_tags(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_photo_tags(uuid, uuid[]) TO authenticated;

-- feed_photo_gallery_group for many uploaders in one round trip, for the
-- "Photos of you" strip. Rows with a null group_id share no visible gallery.
CREATE FUNCTION public.feed_photo_gallery_groups(p_uploader_ids uuid[], p_festival_id uuid)
RETURNS TABLE (uploader_id uuid, group_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT uploader, public.feed_photo_gallery_group(uploader, p_festival_id)
  FROM unnest(p_uploader_ids) AS uploader
$$;
REVOKE ALL ON FUNCTION public.feed_photo_gallery_groups(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_photo_gallery_groups(uuid[], uuid) TO authenticated;
