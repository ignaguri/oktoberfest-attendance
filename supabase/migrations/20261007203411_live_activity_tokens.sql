-- Push tokens for the lock-screen drink counter (iOS Live Activity, Android
-- ongoing notification). One row per running surface. The API reads and
-- prunes them as the user, under RLS, after a write changes that user's day.

CREATE TABLE public.live_activity_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  token text NOT NULL,
  apns_environment text CHECK (apns_environment IN ('sandbox', 'production')),
  festival_id uuid NOT NULL REFERENCES public.festivals (id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- An Android push token is per device install, so two accounts on one
  -- device must not collide.
  UNIQUE (user_id, token),
  CHECK (platform = 'android' OR apns_environment IS NOT NULL)
);

CREATE INDEX live_activity_tokens_user_id_idx ON public.live_activity_tokens (user_id);

CREATE TRIGGER update_live_activity_tokens_updated_at
  BEFORE UPDATE ON public.live_activity_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.live_activity_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their live activity tokens" ON public.live_activity_tokens
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Owners add their live activity tokens" ON public.live_activity_tokens
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Owners update their live activity tokens" ON public.live_activity_tokens
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Owners delete their live activity tokens" ON public.live_activity_tokens
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Default privileges grant anon and authenticated everything; keep only what
-- the owner policies need.
REVOKE ALL ON TABLE public.live_activity_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.live_activity_tokens TO authenticated;
GRANT ALL ON TABLE public.live_activity_tokens TO service_role;
