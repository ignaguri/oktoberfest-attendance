-- Copy production data to testing schema
-- This migration populates the testing schema with production data structure and sample data

-- First, let's properly set up the testing schema tables with correct structure
-- Drop existing tables and recreate them properly
DROP TABLE IF EXISTS testing.profiles CASCADE;
DROP TABLE IF EXISTS testing.festivals CASCADE;
DROP TABLE IF EXISTS testing.tents CASCADE;
DROP TABLE IF EXISTS testing.winning_criteria CASCADE;
DROP TABLE IF EXISTS testing.groups CASCADE;
DROP TABLE IF EXISTS testing.group_members CASCADE;
DROP TABLE IF EXISTS testing.attendances CASCADE;
DROP TABLE IF EXISTS testing.beer_pictures CASCADE;
DROP TABLE IF EXISTS testing.tent_visits CASCADE;
DROP TABLE IF EXISTS testing.festival_tent_pricing CASCADE;
DROP TABLE IF EXISTS testing.achievements CASCADE;
DROP TABLE IF EXISTS testing.user_achievements CASCADE;
DROP TABLE IF EXISTS testing.attendance CASCADE;

-- Recreate tables with proper structure (copying from public schema)
-- We'll use the same structure but in the testing schema

-- Copy profiles table structure
CREATE TABLE testing.profiles (
  LIKE public.profiles INCLUDING ALL
);

-- Copy festivals table structure
CREATE TABLE testing.festivals (
  LIKE public.festivals INCLUDING ALL
);

-- Copy tents table structure
CREATE TABLE testing.tents (
  LIKE public.tents INCLUDING ALL
);

-- Copy winning_criteria table structure
CREATE TABLE testing.winning_criteria (
  LIKE public.winning_criteria INCLUDING ALL
);

-- Copy groups table structure
CREATE TABLE testing.groups (
  LIKE public.groups INCLUDING ALL
);

-- Copy group_members table structure
CREATE TABLE testing.group_members (
  LIKE public.group_members INCLUDING ALL
);

-- Copy attendances table structure
CREATE TABLE testing.attendances (
  LIKE public.attendances INCLUDING ALL
);

-- Copy beer_pictures table structure
CREATE TABLE testing.beer_pictures (
  LIKE public.beer_pictures INCLUDING ALL
);

-- Copy tent_visits table structure
CREATE TABLE testing.tent_visits (
  LIKE public.tent_visits INCLUDING ALL
);

-- Copy festival_tent_pricing table structure
CREATE TABLE testing.festival_tent_pricing (
  LIKE public.festival_tent_pricing INCLUDING ALL
);

-- Copy achievements table structure
CREATE TABLE testing.achievements (
  LIKE public.achievements INCLUDING ALL
);

-- Copy user_achievements table structure
CREATE TABLE testing.user_achievements (
  LIKE public.user_achievements INCLUDING ALL
);

-- Copy attendance table structure (legacy)
CREATE TABLE testing.attendance (
  LIKE public.attendance INCLUDING ALL
);

-- Copy data from production to testing
-- We'll copy a subset of data to avoid overwhelming the testing environment

-- Copy profiles (copy all - needed for user authentication)
INSERT INTO testing.profiles SELECT * FROM public.profiles;

-- Copy winning criteria (small table, copy all)
INSERT INTO testing.winning_criteria SELECT * FROM public.winning_criteria;

-- Copy tents (small table, copy all)
INSERT INTO testing.tents SELECT * FROM public.tents;

-- Copy achievements (small table, copy all)
INSERT INTO testing.achievements SELECT * FROM public.achievements;

-- Copy festivals (copy all but limit to recent ones if there are many)
INSERT INTO testing.festivals 
SELECT * FROM public.festivals 
WHERE created_at >= (NOW() - INTERVAL '1 year')
ORDER BY created_at DESC;

-- Copy groups for the festivals we copied
INSERT INTO testing.groups 
SELECT g.* FROM public.groups g
INNER JOIN testing.festivals tf ON g.festival_id = tf.id;

-- Copy group members for the groups we copied
INSERT INTO testing.group_members 
SELECT gm.* FROM public.group_members gm
INNER JOIN testing.groups tg ON gm.group_id = tg.id;

-- Copy attendances for the festivals we copied
INSERT INTO testing.attendances 
SELECT a.* FROM public.attendances a
INNER JOIN testing.festivals tf ON a.festival_id = tf.id;

-- Copy beer pictures for the attendances we copied
INSERT INTO testing.beer_pictures 
SELECT bp.* FROM public.beer_pictures bp
INNER JOIN testing.attendances ta ON bp.attendance_id = ta.id;

-- Copy tent visits for the festivals we copied
INSERT INTO testing.tent_visits 
SELECT tv.* FROM public.tent_visits tv
INNER JOIN testing.festivals tf ON tv.festival_id = tf.id;

-- Copy festival tent pricing for the festivals we copied
INSERT INTO testing.festival_tent_pricing 
SELECT ftp.* FROM public.festival_tent_pricing ftp
INNER JOIN testing.festivals tf ON ftp.festival_id = tf.id;

-- Copy user achievements for the festivals we copied
INSERT INTO testing.user_achievements 
SELECT ua.* FROM public.user_achievements ua
INNER JOIN testing.festivals tf ON ua.festival_id = tf.id;

-- Copy attendance (legacy) - limit to recent data
INSERT INTO testing.attendance 
SELECT * FROM public.attendance 
WHERE created_at >= (NOW() - INTERVAL '1 year')
ORDER BY created_at DESC;

-- Recreate the handle_new_user function in testing schema
CREATE OR REPLACE FUNCTION testing.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO testing.profiles (id, username, full_name, avatar_url, website, custom_beer_cost)
  VALUES (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'website', 16.2);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the results view in testing schema
CREATE OR REPLACE VIEW testing.results AS
 SELECT "p"."username",
    "p"."full_name",
    "p"."avatar_url",
    "u"."email",
    "agg"."total_days",
    "agg"."total_liters",
    "agg"."average_liters"
   FROM (("testing"."profiles" "p"
     LEFT JOIN "auth"."users" "u" ON (("p"."id" = "u"."id")))
     LEFT JOIN ( SELECT "a"."user_id",
            "count"("a"."date") AS "total_days",
            "sum"("a"."liters") AS "total_liters",
            "avg"(("a"."liters")::double precision) AS "average_liters"
           FROM "testing"."attendance" "a"
          GROUP BY "a"."user_id"
         HAVING ("count"("a"."date") > 0)) "agg" ON (("p"."id" = "agg"."user_id")))
  WHERE ("agg"."total_days" > 0);

-- Create indexes on the testing schema tables for better performance
-- Copy the same indexes that exist on the public schema tables

-- Create indexes for profiles
CREATE INDEX IF NOT EXISTS testing_profiles_username_idx ON testing.profiles(username);

-- Create indexes for festivals
CREATE INDEX IF NOT EXISTS testing_festivals_created_at_idx ON testing.festivals(created_at);
CREATE INDEX IF NOT EXISTS testing_festivals_status_idx ON testing.festivals(status);

-- Create indexes for groups
CREATE INDEX IF NOT EXISTS testing_groups_festival_id_idx ON testing.groups(festival_id);
CREATE INDEX IF NOT EXISTS testing_groups_created_by_idx ON testing.groups(created_by);

-- Create indexes for group_members
CREATE INDEX IF NOT EXISTS testing_group_members_group_id_idx ON testing.group_members(group_id);
CREATE INDEX IF NOT EXISTS testing_group_members_user_id_idx ON testing.group_members(user_id);

-- Create indexes for attendances
CREATE INDEX IF NOT EXISTS testing_attendances_festival_id_idx ON testing.attendances(festival_id);
CREATE INDEX IF NOT EXISTS testing_attendances_user_id_idx ON testing.attendances(user_id);
CREATE INDEX IF NOT EXISTS testing_attendances_date_idx ON testing.attendances(date);

-- Create indexes for beer_pictures
CREATE INDEX IF NOT EXISTS testing_beer_pictures_attendance_id_idx ON testing.beer_pictures(attendance_id);
CREATE INDEX IF NOT EXISTS testing_beer_pictures_user_id_idx ON testing.beer_pictures(user_id);

-- Create indexes for tent_visits
CREATE INDEX IF NOT EXISTS testing_tent_visits_festival_id_idx ON testing.tent_visits(festival_id);
CREATE INDEX IF NOT EXISTS testing_tent_visits_user_id_idx ON testing.tent_visits(user_id);
CREATE INDEX IF NOT EXISTS testing_tent_visits_tent_id_idx ON testing.tent_visits(tent_id);

-- Create indexes for festival_tent_pricing
CREATE INDEX IF NOT EXISTS testing_festival_tent_pricing_festival_id_idx ON testing.festival_tent_pricing(festival_id);
CREATE INDEX IF NOT EXISTS testing_festival_tent_pricing_tent_id_idx ON testing.festival_tent_pricing(tent_id);

-- Create indexes for user_achievements
CREATE INDEX IF NOT EXISTS testing_user_achievements_festival_id_idx ON testing.user_achievements(festival_id);
CREATE INDEX IF NOT EXISTS testing_user_achievements_user_id_idx ON testing.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS testing_user_achievements_achievement_id_idx ON testing.user_achievements(achievement_id);

-- Create indexes for attendance (legacy)
CREATE INDEX IF NOT EXISTS testing_attendance_user_id_idx ON testing.attendance(user_id);
CREATE INDEX IF NOT EXISTS testing_attendance_date_idx ON testing.attendance(date);

-- Grant permissions
GRANT USAGE ON SCHEMA testing TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA testing TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA testing TO authenticated;
GRANT EXECUTE ON FUNCTION testing.handle_new_user() TO authenticated;
GRANT SELECT ON testing.results TO authenticated;

-- Create a view to easily see which schema is active
CREATE OR REPLACE VIEW testing.schema_status AS
SELECT 
  schema_name,
  is_testing_mode,
  updated_at,
  CASE 
    WHEN is_testing_mode THEN 'Testing Mode Active'
    ELSE 'Production Mode Active'
  END as status
FROM testing.schema_config
ORDER BY updated_at DESC
LIMIT 1;

-- Grant access to the view
GRANT SELECT ON testing.schema_status TO authenticated;
