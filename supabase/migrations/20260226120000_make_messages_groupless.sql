-- =====================================================
-- Make messages groupless: remove group_id, add festival_id + visibility
--
-- Messages are no longer scoped to a single group.
-- Instead, a message belongs to a user + festival and is visible
-- to all groups the user is a member of in that festival.
-- =====================================================

-- 1. Create visibility enum
DO $$ BEGIN
  CREATE TYPE message_visibility AS ENUM ('groups', 'public');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add festival_id column (backfill from group before dropping group_id)
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS festival_id uuid;

-- 3. Add visibility column
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS visibility message_visibility NOT NULL DEFAULT 'groups';

-- 4. Backfill festival_id from the group's festival_id for existing messages
UPDATE public.group_messages gm
SET festival_id = g.festival_id
FROM public.groups g
WHERE gm.group_id = g.id
AND gm.festival_id IS NULL;

-- 5. Delete orphaned messages that couldn't be backfilled
DELETE FROM public.group_messages WHERE festival_id IS NULL;

-- 6. Make festival_id NOT NULL now that backfill is done
ALTER TABLE public.group_messages
  ALTER COLUMN festival_id SET NOT NULL;

-- 7. Add FK constraint for festival_id
ALTER TABLE public.group_messages
  ADD CONSTRAINT group_messages_festival_id_fkey
  FOREIGN KEY (festival_id) REFERENCES public.festivals(id) ON DELETE CASCADE;

-- 8. Drop old RLS policies (must happen BEFORE dropping group_id, since policies reference it)
DROP POLICY IF EXISTS "Group members can view messages" ON public.group_messages;
DROP POLICY IF EXISTS "Group members can post messages" ON public.group_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.group_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.group_messages;
DROP POLICY IF EXISTS "Super admins can do anything with group messages" ON public.group_messages;

-- 9. Drop old indexes that reference group_id
DROP INDEX IF EXISTS idx_group_messages_group;
DROP INDEX IF EXISTS idx_group_messages_pinned;

-- 10. Drop FK constraint on group_id
ALTER TABLE public.group_messages
  DROP CONSTRAINT IF EXISTS group_messages_group_id_fkey;

-- 11. Drop the group_id column (no backward compat needed — feature is dev-only)
ALTER TABLE public.group_messages
  DROP COLUMN IF EXISTS group_id;

-- 12. Create new indexes
CREATE INDEX IF NOT EXISTS idx_group_messages_festival
  ON public.group_messages(festival_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_messages_user_festival
  ON public.group_messages(user_id, festival_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_messages_pinned_festival
  ON public.group_messages(festival_id, pinned)
  WHERE pinned = true;

-- 13. Create new RLS policies

-- SELECT: User can see a message if they are the author,
-- or visibility is public, or they share a group with the author in the same festival
CREATE POLICY "Users can view messages"
  ON public.group_messages FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR visibility = 'public'
    OR EXISTS (
      SELECT 1 FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      JOIN public.groups g ON g.id = gm1.group_id
      WHERE gm1.user_id = (SELECT auth.uid())
      AND gm2.user_id = group_messages.user_id
      AND g.festival_id = group_messages.festival_id
    )
  );

-- INSERT: User must be member of at least one group in the festival
CREATE POLICY "Users can post messages"
  ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.user_id = (SELECT auth.uid())
      AND g.festival_id = group_messages.festival_id
    )
  );

-- UPDATE: Own messages only
CREATE POLICY "Users can update own messages"
  ON public.group_messages FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE: Own messages only
CREATE POLICY "Users can delete own messages"
  ON public.group_messages FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Super admin override
CREATE POLICY "Super admins can do anything with group messages"
  ON public.group_messages FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
