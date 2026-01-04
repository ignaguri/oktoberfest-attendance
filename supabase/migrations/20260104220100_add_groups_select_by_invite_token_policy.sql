-- Fix: Allow users to view groups by invite_token for joining
-- This is required because the current SELECT policy only allows members to see groups
-- But when joining via invite link, the user is not yet a member

CREATE POLICY "Users can view groups by invite token"
ON public.groups
FOR SELECT
USING (invite_token IS NOT NULL);
