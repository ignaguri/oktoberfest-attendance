-- Photo reaction push: a dedupe ledger so the uploader hears about each reactor
-- once per photo.
--
-- Changing a reaction is a remove followed by an add, so the reaction rows
-- themselves cannot tell a first reaction from a changed one. Inserting here
-- with ON CONFLICT DO NOTHING is the dedupe.
CREATE TABLE public.photo_reaction_notifications (
  photo_id uuid NOT NULL REFERENCES public.beer_pictures(id) ON DELETE CASCADE,
  reactor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (photo_id, reactor_id)
);

ALTER TABLE public.photo_reaction_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.photo_reaction_notifications FROM anon, authenticated;
GRANT ALL ON public.photo_reaction_notifications TO service_role;
