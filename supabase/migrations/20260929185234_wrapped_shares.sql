-- Wrapped share links (sub-project 3).
--
-- A row is a public link to one share card: an unguessable token and the card's
-- JSON, frozen when the user tapped "Copy link". Created only on that tap, never
-- by sharing an image. Revoking sets revoked_at; a revoked token never comes back.
-- The photos card is not linkable (photos carry a visibility flag and friends'
-- faces), which the card_kind check enforces.

CREATE TABLE public.wrapped_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/=', '-_'),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES public.festivals (id) ON DELETE CASCADE,
  card_kind text NOT NULL CHECK (card_kind IN ('numbers', 'persona', 'rhythm', 'city')),
  card_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

-- One live link per card; copying again reuses it.
CREATE UNIQUE INDEX wrapped_shares_one_live_per_card
  ON public.wrapped_shares (user_id, festival_id, card_kind)
  WHERE revoked_at IS NULL;

CREATE TRIGGER update_wrapped_shares_updated_at
  BEFORE UPDATE ON public.wrapped_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.wrapped_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their share links" ON public.wrapped_shares
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Revoke is the one write a user makes: it sets revoked_at on a live link and
-- nothing else. There is no insert or delete policy.
CREATE POLICY "Owners revoke their share links" ON public.wrapped_shares
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id AND revoked_at IS NULL)
  WITH CHECK ((SELECT auth.uid()) = user_id AND revoked_at IS NOT NULL);

-- The snapshot is published under the ProstCounter name, so only the API
-- writes it (service role, from the user's own Wrapped). Default privileges
-- give authenticated every table right; take them back and grant only what
-- revoking needs.
REVOKE ALL ON TABLE public.wrapped_shares FROM anon, authenticated;
GRANT SELECT ON TABLE public.wrapped_shares TO authenticated;
GRANT UPDATE (revoked_at) ON TABLE public.wrapped_shares TO authenticated;

-- The only public read: a live link's card, by token.
CREATE FUNCTION public.get_wrapped_share(p_token text)
RETURNS TABLE (card_kind text, card_data jsonb, festival_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.card_kind, s.card_data, f.name
  FROM public.wrapped_shares s
  JOIN public.festivals f ON f.id = s.festival_id
  WHERE s.token = p_token AND s.revoked_at IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.get_wrapped_share(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_wrapped_share(text) TO anon, authenticated, service_role;
