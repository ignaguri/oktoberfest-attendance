-- Fix: Allow users to view groups by invite_token for joining
-- This is required because the current SELECT policy only allows members to see groups
-- But when joining via invite link, the user is not yet a member

-- Note: Using DROP IF EXISTS to make this migration idempotent
DROP POLICY IF EXISTS "Users can view groups by invite token" ON public.groups;
CREATE POLICY "Users can view groups by invite token"
ON public.groups
FOR SELECT
USING (invite_token IS NOT NULL);
