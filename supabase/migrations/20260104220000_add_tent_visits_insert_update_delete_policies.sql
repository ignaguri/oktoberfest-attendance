-- Fix: Add INSERT/UPDATE/DELETE RLS policies for tent_visits table
-- This allows the add_or_update_attendance_with_tents function to work properly
-- when users select a tent during attendance registration

-- Add INSERT policy for tent_visits - users can insert their own tent visits
CREATE POLICY "Users can insert own tent visits"
ON public.tent_visits
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy for tent_visits - users can update their own tent visits
CREATE POLICY "Users can update own tent visits"
ON public.tent_visits
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy for tent_visits - users can delete their own tent visits
CREATE POLICY "Users can delete own tent visits"
ON public.tent_visits
FOR DELETE
USING (auth.uid() = user_id);
