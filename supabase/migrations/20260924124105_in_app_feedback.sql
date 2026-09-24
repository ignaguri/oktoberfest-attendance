-- In-app feedback: a rating for yesterday's festival day, bug reports and
-- feature requests, plus a log of every day prompt shown so the
-- two-per-festival cap holds across devices.
--
-- Written through the API with the caller's own token, so RLS is the only
-- guard. Users write and read only their own rows; super admins read all.

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CONSTRAINT feedback_kind_check CHECK (kind IN ('day', 'bug', 'idea')),
  rating smallint CONSTRAINT feedback_rating_range CHECK (rating BETWEEN 1 AND 5),
  message text CONSTRAINT feedback_message_length CHECK (char_length(message) <= 2000),
  -- SET NULL keeps the text of a bug report when its festival is deleted. The
  -- "day rows need a festival" rule lives in the API: a CHECK here would make
  -- the SET NULL fail.
  festival_id uuid REFERENCES public.festivals(id) ON DELETE SET NULL,
  day date,
  platform text,
  app_version text,
  locale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_rating_only_for_day CHECK ((kind = 'day') = (rating IS NOT NULL)),
  CONSTRAINT feedback_day_only_for_day CHECK ((kind = 'day') = (day IS NOT NULL)),
  CONSTRAINT feedback_text_kinds_need_message CHECK (
    kind = 'day' OR (message IS NOT NULL AND btrim(message) <> '')
  )
);

-- One rating per festival day; a retried submit hits this instead of doubling up
CREATE UNIQUE INDEX feedback_one_day_rating
  ON public.feedback (user_id, festival_id, day)
  WHERE kind = 'day';

-- Admin list, newest first
CREATE INDEX feedback_created_at ON public.feedback (created_at DESC);

-- Per-user rate limit on bug reports and ideas
CREATE INDEX feedback_user_created_at ON public.feedback (user_id, created_at);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.feedback FROM anon;

CREATE POLICY "Users can submit their own feedback"
  ON public.feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can read their own feedback"
  ON public.feedback
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Super admins can read all feedback"
  ON public.feedback
  FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE TABLE public.feedback_prompts (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  day date NOT NULL,
  outcome text NOT NULL CONSTRAINT feedback_prompts_outcome_check CHECK (outcome IN ('answered', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, festival_id, day)
);

ALTER TABLE public.feedback_prompts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.feedback_prompts FROM anon;

CREATE POLICY "Users can record their own feedback prompts"
  ON public.feedback_prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can read their own feedback prompts"
  ON public.feedback_prompts
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Super admins can read all feedback prompts"
  ON public.feedback_prompts
  FOR SELECT
  TO authenticated
  USING (is_super_admin());
