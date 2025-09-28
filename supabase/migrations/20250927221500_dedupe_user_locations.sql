-- Deduplicate user_locations rows and enforce a unique record per user and festival
-- This migration removes the previous partial unique index and replaces it with
-- a full unique constraint on (user_id, festival_id). It also removes
-- historical duplicates, keeping the most recent active (or latest) entry.

-- Drop the existing partial unique index/constraint if it still exists
DROP INDEX IF EXISTS unique_active_location_per_user_festival;
ALTER TABLE user_locations
  DROP CONSTRAINT IF EXISTS unique_active_location_per_user_festival;

-- Remove duplicate rows, keeping the latest active record when available
WITH ranked_locations AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, festival_id
      ORDER BY
        (status = 'active') DESC,
        last_updated DESC,
        updated_at DESC,
        created_at DESC
    ) AS row_number
  FROM user_locations
)
DELETE FROM user_locations
WHERE id IN (
  SELECT id
  FROM ranked_locations
  WHERE row_number > 1
);

-- Ensure last_updated is populated for any remaining records
UPDATE user_locations
SET last_updated = NOW()
WHERE last_updated IS NULL;

-- Add the new unique constraint enforcing a single row per user/festival pair
ALTER TABLE user_locations
  ADD CONSTRAINT user_locations_unique_user_festival UNIQUE (user_id, festival_id);
