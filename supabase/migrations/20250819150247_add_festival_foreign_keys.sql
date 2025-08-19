-- Multi-Festival Support Migration
-- Phase 2: Add festival_id foreign keys and migrate existing data

-- Add festival_id columns (nullable initially to avoid breaking existing data)
ALTER TABLE attendances ADD COLUMN festival_id UUID REFERENCES festivals(id);
ALTER TABLE groups ADD COLUMN festival_id UUID REFERENCES festivals(id);
ALTER TABLE tent_visits ADD COLUMN festival_id UUID REFERENCES festivals(id);

-- Add indexes for performance
CREATE INDEX idx_attendances_festival_id ON attendances(festival_id);
CREATE INDEX idx_groups_festival_id ON groups(festival_id);
CREATE INDEX idx_tent_visits_festival_id ON tent_visits(festival_id);

-- Migrate existing data to link with 2024 Oktoberfest
-- Get the 2024 Oktoberfest festival_id and update all existing records
WITH oktoberfest_2024 AS (
  SELECT id as festival_id FROM festivals WHERE short_name = 'oktoberfest-2024'
)
UPDATE attendances 
SET festival_id = (SELECT festival_id FROM oktoberfest_2024)
WHERE festival_id IS NULL;

WITH oktoberfest_2024 AS (
  SELECT id as festival_id FROM festivals WHERE short_name = 'oktoberfest-2024'
)
UPDATE groups 
SET festival_id = (SELECT festival_id FROM oktoberfest_2024)
WHERE festival_id IS NULL;

WITH oktoberfest_2024 AS (
  SELECT id as festival_id FROM festivals WHERE short_name = 'oktoberfest-2024'
)
UPDATE tent_visits 
SET festival_id = (SELECT festival_id FROM oktoberfest_2024)
WHERE festival_id IS NULL;

-- Make festival_id NOT NULL after migration
ALTER TABLE attendances ALTER COLUMN festival_id SET NOT NULL;
ALTER TABLE groups ALTER COLUMN festival_id SET NOT NULL;
ALTER TABLE tent_visits ALTER COLUMN festival_id SET NOT NULL;

-- Update unique constraints to include festival_id
-- Drop old constraints
ALTER TABLE attendances DROP CONSTRAINT IF EXISTS unique_user_date;
ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_user_id_group_id_date_key;
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_name_key;

-- Add new festival-aware constraints
ALTER TABLE attendances ADD CONSTRAINT unique_user_date_festival UNIQUE (user_id, date, festival_id);
ALTER TABLE groups ADD CONSTRAINT unique_group_name_festival UNIQUE (name, festival_id);

-- Update existing leaderboard view to be festival-aware (drop and recreate)
DROP VIEW IF EXISTS leaderboard;

CREATE VIEW leaderboard AS  
SELECT 
    u.id AS user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    g.id AS group_id,
    g.name AS group_name,
    g.festival_id,
    f.name AS festival_name,
    count(DISTINCT a.date) AS days_attended,
    COALESCE(avg(a.beer_count), (0)::numeric) AS avg_beers,
    COALESCE(sum(a.beer_count), (0)::bigint) AS total_beers
FROM 
    auth.users u
    JOIN group_members gm ON u.id = gm.user_id
    JOIN groups g ON gm.group_id = g.id
    JOIN festivals f ON g.festival_id = f.id
    LEFT JOIN attendances a ON u.id = a.user_id AND g.festival_id = a.festival_id
    JOIN profiles p ON u.id = p.id
WHERE 
    EXISTS (
        SELECT 1
        FROM group_members gm2
        WHERE gm2.group_id = g.id 
        AND gm2.user_id = (select auth.uid())
    )
GROUP BY 
    u.id, p.username, p.full_name, p.avatar_url, g.id, g.name, g.festival_id, f.name;