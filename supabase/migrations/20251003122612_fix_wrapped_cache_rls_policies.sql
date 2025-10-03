-- Fix RLS policies for wrapped_data_cache table
-- Add INSERT and UPDATE policies for users to manage their own cache entries

-- Allow users to insert their own cache entries
CREATE POLICY "Users can insert own wrapped cache" ON wrapped_data_cache
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own cache entries
CREATE POLICY "Users can update own wrapped cache" ON wrapped_data_cache
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own cache entries (for cache invalidation)
CREATE POLICY "Users can delete own wrapped cache" ON wrapped_data_cache
  FOR DELETE USING (auth.uid() = user_id);
