-- =====================================================
-- Drop superseded attendances read policy
-- =====================================================
-- "Users can view activity feed from shared group members"
-- (20260317150001_friendship_visibility_updates) is the read rule for
-- attendances: own rows, shared-group members in the attendance's festival,
-- and friends. The older "Users can view own and group members' attendance"
-- policy from the baseline was never removed, and because permissive policies
-- are OR'ed it widened that rule. Drop the duplicate.
-- =====================================================

DROP POLICY IF EXISTS "Users can view own and group members' attendance" ON public.attendances;
