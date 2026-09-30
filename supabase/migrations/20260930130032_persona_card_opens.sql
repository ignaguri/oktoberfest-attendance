-- Which Wrapped persona cards each user has opened in the persona collection.
-- Keyed by persona, not festival: earning a persona again at another festival
-- does not deal a new face-down card. Insert-only; an open is permanent.
CREATE TABLE IF NOT EXISTS public.persona_card_opens (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  persona_id text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, persona_id)
);

ALTER TABLE public.persona_card_opens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.persona_card_opens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.persona_card_opens TO authenticated;
GRANT ALL ON public.persona_card_opens TO service_role;

CREATE POLICY "Users can view own persona card opens" ON public.persona_card_opens
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can record own persona card opens" ON public.persona_card_opens
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.persona_card_opens IS
  'Persona collection cards each user has flipped open. persona_id is a PERSONA_IDS value (validated by the API, no CHECK so new personas need no migration).';
