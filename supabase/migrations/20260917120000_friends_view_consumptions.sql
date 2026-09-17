-- =====================================================
-- Friends can view friends' consumptions
-- =====================================================
-- 20260317150001_friendship_visibility_updates gave friends the same read
-- access as shared-group members on attendances, tent_visits and
-- beer_pictures, but missed consumptions. The past-day "friends who went"
-- recap shows each friend's drinks by type, so friends outside a shared group
-- would otherwise appear with no drinks.
--
-- Keeps the group clause (members of a group in the attendance's festival)
-- and adds is_friend(). Own rows stay covered by "Users can view own
-- consumptions".
-- =====================================================

DROP POLICY IF EXISTS "Group members can view member consumptions" ON public.consumptions;

CREATE POLICY "Friends and group members can view consumptions"
  ON public.consumptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendances a
      WHERE a.id = consumptions.attendance_id
      AND (
        EXISTS (
          SELECT 1 FROM public.v_user_shared_group_members v
          WHERE v.owner_id = a.user_id
          AND v.viewer_id = (SELECT auth.uid())
          AND v.festival_id = a.festival_id
        )
        OR public.is_friend((SELECT auth.uid()), a.user_id)
      )
    )
  );
