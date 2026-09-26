-- Signed-URL photo uploads that have not been confirmed yet. The beer_pictures
-- row used to be created when the upload URL was issued, so an upload that
-- never reached storage (flaky festival network) left a live public photo
-- with no image. The row now waits here, and confirm only moves it into
-- beer_pictures once the file exists. Its id becomes the picture's id, so the
-- pictureId clients already get from the upload URL keeps working.
CREATE TABLE public.photo_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES public.attendances(id) ON DELETE CASCADE,
  picture_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_photo_uploads_user ON public.photo_uploads (user_id);
CREATE INDEX idx_photo_uploads_attendance ON public.photo_uploads (attendance_id);

ALTER TABLE public.photo_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own pending uploads"
  ON public.photo_uploads FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users start uploads on their own attendances"
  ON public.photo_uploads FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.attendances a
      WHERE a.id = photo_uploads.attendance_id
        AND a.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users clear their own pending uploads"
  ON public.photo_uploads FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Supabase grants new tables to anon/authenticated directly, so revoke by name.
REVOKE ALL ON public.photo_uploads FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.photo_uploads TO authenticated;
GRANT ALL ON public.photo_uploads TO service_role;
