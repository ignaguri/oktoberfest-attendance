-- =====================================================
-- Add Social Features: Photo Reactions/Comments,
-- Crowd Reports, and Group Messages
-- =====================================================

-- =====================================================
-- PART 1: Photo Reactions & Comments (Group-Scoped)
-- =====================================================

-- Photo reactions (emoji-style, group-scoped)
CREATE TABLE IF NOT EXISTS public.photo_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.beer_pictures(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(photo_id, group_id, user_id, emoji)
);

-- Photo comments (group-scoped)
CREATE TABLE IF NOT EXISTS public.photo_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.beer_pictures(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- FK to profiles for PostgREST joins
DO $$ BEGIN
  ALTER TABLE public.photo_reactions
  ADD CONSTRAINT photo_reactions_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.photo_comments
  ADD CONSTRAINT photo_comments_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_photo_reactions_photo_group ON public.photo_reactions(photo_id, group_id);
CREATE INDEX IF NOT EXISTS idx_photo_comments_photo_group ON public.photo_comments(photo_id, group_id);
CREATE INDEX IF NOT EXISTS idx_photo_comments_created_at ON public.photo_comments(created_at);

-- RLS
ALTER TABLE public.photo_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Photo Reactions
CREATE POLICY "Group members can view photo reactions"
  ON public.photo_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = photo_reactions.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can add photo reactions"
  ON public.photo_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = photo_reactions.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own photo reactions"
  ON public.photo_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can do anything with photo reactions"
  ON public.photo_reactions FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- RLS Policies: Photo Comments
CREATE POLICY "Group members can view photo comments"
  ON public.photo_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = photo_comments.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can add photo comments"
  ON public.photo_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = photo_comments.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own photo comments"
  ON public.photo_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own photo comments"
  ON public.photo_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can do anything with photo comments"
  ON public.photo_comments FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =====================================================
-- PART 2: Tent Crowd Reports
-- =====================================================

-- Crowd level enum
DO $$ BEGIN
  CREATE TYPE crowd_level AS ENUM ('empty', 'moderate', 'crowded', 'full');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tent crowd reports
CREATE TABLE IF NOT EXISTS public.tent_crowd_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tent_id uuid NOT NULL REFERENCES public.tents(id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crowd_level crowd_level NOT NULL,
  wait_time_minutes integer CHECK (wait_time_minutes >= 0 AND wait_time_minutes <= 180),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- FK to profiles for PostgREST joins
DO $$ BEGIN
  ALTER TABLE public.tent_crowd_reports
  ADD CONSTRAINT tent_crowd_reports_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tent_crowd_reports_tent_festival ON public.tent_crowd_reports(tent_id, festival_id);
CREATE INDEX IF NOT EXISTS idx_tent_crowd_reports_created_at ON public.tent_crowd_reports(created_at);

-- RLS
ALTER TABLE public.tent_crowd_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view crowd reports"
  ON public.tent_crowd_reports FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create crowd reports"
  ON public.tent_crowd_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON public.tent_crowd_reports FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can do anything with tent crowd reports"
  ON public.tent_crowd_reports FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Aggregation view for current crowd status (last 30 minutes)
-- Uses festival_tents to scope tents to their festival
DROP VIEW IF EXISTS public.tent_crowd_status;

CREATE VIEW public.tent_crowd_status WITH (security_invoker = true) AS
SELECT
  ft.festival_id,
  ft.tent_id,
  t.name AS tent_name,
  COUNT(tcr.id) AS report_count,
  MODE() WITHIN GROUP (ORDER BY tcr.crowd_level) AS crowd_level,
  ROUND(AVG(tcr.wait_time_minutes)) AS avg_wait_minutes,
  MAX(tcr.created_at) AS last_reported_at
FROM public.festival_tents ft
JOIN public.tents t ON t.id = ft.tent_id
LEFT JOIN public.tent_crowd_reports tcr
  ON tcr.tent_id = ft.tent_id
  AND tcr.festival_id = ft.festival_id
  AND tcr.created_at > NOW() - INTERVAL '30 minutes'
GROUP BY ft.festival_id, ft.tent_id, t.name;

-- =====================================================
-- PART 3: Group Messages
-- =====================================================

-- Message type enum
DO $$ BEGIN
  CREATE TYPE group_message_type AS ENUM ('message', 'alert');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Group messages table
CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  message_type group_message_type NOT NULL DEFAULT 'message',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- FK to profiles for PostgREST joins
DO $$ BEGIN
  ALTER TABLE public.group_messages
  ADD CONSTRAINT group_messages_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON public.group_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_messages_pinned ON public.group_messages(group_id, pinned) WHERE pinned = true;

-- RLS
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view messages"
  ON public.group_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_messages.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can post messages"
  ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_messages.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own messages"
  ON public.group_messages FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own messages"
  ON public.group_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can do anything with group messages"
  ON public.group_messages FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
