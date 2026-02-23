-- =====================================================
-- Add Photo Reactions & Comments (Group-Scoped)
-- =====================================================
-- Social features for group galleries:
-- - Emoji reactions on photos (per group)
-- - Text comments on photos (per group)
-- Both are scoped to groups so the same photo in
-- different groups has separate interactions.
-- =====================================================

-- =====================================================
-- PART 1: Create Tables
-- =====================================================

-- Photo reactions (emoji-style, group-scoped)
CREATE TABLE public.photo_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.beer_pictures(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(photo_id, group_id, user_id, emoji)
);

-- Photo comments (group-scoped)
CREATE TABLE public.photo_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.beer_pictures(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- PART 1b: Add FK to profiles for PostgREST joins
-- =====================================================

ALTER TABLE public.photo_reactions
ADD CONSTRAINT photo_reactions_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.photo_comments
ADD CONSTRAINT photo_comments_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- =====================================================
-- PART 2: Indexes
-- =====================================================

CREATE INDEX idx_photo_reactions_photo_group ON public.photo_reactions(photo_id, group_id);
CREATE INDEX idx_photo_comments_photo_group ON public.photo_comments(photo_id, group_id);
CREATE INDEX idx_photo_comments_created_at ON public.photo_comments(created_at);

-- =====================================================
-- PART 3: Enable RLS
-- =====================================================

ALTER TABLE public.photo_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_comments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 4: RLS Policies - Photo Reactions
-- =====================================================

-- SELECT: User must be a member of the group
CREATE POLICY "Group members can view photo reactions"
  ON public.photo_reactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = photo_reactions.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- INSERT: User must be a member of the group
CREATE POLICY "Group members can add photo reactions"
  ON public.photo_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = photo_reactions.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- DELETE: User can only delete their own reactions
CREATE POLICY "Users can delete own photo reactions"
  ON public.photo_reactions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Super admin policy
CREATE POLICY "Super admins can do anything with photo reactions"
  ON public.photo_reactions
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =====================================================
-- PART 5: RLS Policies - Photo Comments
-- =====================================================

-- SELECT: User must be a member of the group
CREATE POLICY "Group members can view photo comments"
  ON public.photo_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = photo_comments.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- INSERT: User must be a member of the group
CREATE POLICY "Group members can add photo comments"
  ON public.photo_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = photo_comments.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- UPDATE: User can only update their own comments
CREATE POLICY "Users can update own photo comments"
  ON public.photo_comments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: User can only delete their own comments
CREATE POLICY "Users can delete own photo comments"
  ON public.photo_comments
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Super admin policy
CREATE POLICY "Super admins can do anything with photo comments"
  ON public.photo_comments
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
