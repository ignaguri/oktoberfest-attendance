ALTER POLICY "Users can view group memberships they are part of"
ON group_members
USING (user_id = (select auth.uid()));
