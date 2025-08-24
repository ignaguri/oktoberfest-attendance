-- Create testing schema for beta testing environment
-- This allows us to have a separate testing environment without affecting production data

-- Create the testing schema
CREATE SCHEMA IF NOT EXISTS testing;

-- Copy table structures and data from public schema to testing schema
-- We'll copy the structure first, then optionally seed with data

-- Copy profiles table (user profiles - references auth.users)
CREATE TABLE testing.profiles AS 
SELECT * FROM public.profiles WHERE false;

-- Copy festivals table
CREATE TABLE testing.festivals AS 
SELECT * FROM public.festivals WHERE false;

-- Copy tents table (festival-independent)
CREATE TABLE testing.tents AS 
SELECT * FROM public.tents WHERE false;

-- Copy winning_criteria table (festival-independent)
CREATE TABLE testing.winning_criteria AS 
SELECT * FROM public.winning_criteria WHERE false;

-- Copy groups table
CREATE TABLE testing.groups AS 
SELECT * FROM public.groups WHERE false;

-- Copy group_members table
CREATE TABLE testing.group_members AS 
SELECT * FROM public.group_members WHERE false;

-- Copy attendances table
CREATE TABLE testing.attendances AS 
SELECT * FROM public.attendances WHERE false;

-- Copy beer_pictures table
CREATE TABLE testing.beer_pictures AS 
SELECT * FROM public.beer_pictures WHERE false;

-- Copy tent_visits table
CREATE TABLE testing.tent_visits AS 
SELECT * FROM public.tent_visits WHERE false;

-- Copy festival_tent_pricing table
CREATE TABLE testing.festival_tent_pricing AS 
SELECT * FROM public.festival_tent_pricing WHERE false;

-- Copy achievements table (festival-independent)
CREATE TABLE testing.achievements AS 
SELECT * FROM public.achievements WHERE false;

-- Copy user_achievements table
CREATE TABLE testing.user_achievements AS 
SELECT * FROM public.user_achievements WHERE false;

-- Copy attendance table (legacy)
CREATE TABLE testing.attendance AS 
SELECT * FROM public.attendance WHERE false;

-- Copy the handle_new_user function to testing schema
CREATE OR REPLACE FUNCTION testing.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO testing.profiles (id, username, full_name, avatar_url, website, custom_beer_cost)
  VALUES (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'website', 16.2);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Copy the results view to testing schema
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

-- Set up proper sequences for auto-incrementing IDs
-- Note: We'll need to handle sequences separately for tables with identity columns

-- Copy all constraints and indexes
-- This is a simplified approach - in production you might want to script out all constraints

-- Grant permissions to authenticated users for testing schema
GRANT USAGE ON SCHEMA testing TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA testing TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA testing TO authenticated;
GRANT EXECUTE ON FUNCTION testing.handle_new_user() TO authenticated;
GRANT SELECT ON testing.results TO authenticated;

-- Create a function to easily switch between schemas
CREATE OR REPLACE FUNCTION get_current_schema()
RETURNS text AS $$
BEGIN
  -- Check if we're in testing mode via environment variable or config
  -- For now, we'll use a simple approach with a config table
  RETURN 'public';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a config table to control which schema to use
CREATE TABLE IF NOT EXISTS testing.schema_config (
  id SERIAL PRIMARY KEY,
  schema_name text NOT NULL DEFAULT 'public',
  is_testing_mode boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default config
INSERT INTO testing.schema_config (schema_name, is_testing_mode) 
VALUES ('public', false) 
ON CONFLICT DO NOTHING;

-- Create a function to switch to testing mode
CREATE OR REPLACE FUNCTION switch_to_testing_schema()
RETURNS void AS $$
BEGIN
  UPDATE testing.schema_config 
  SET schema_name = 'testing', is_testing_mode = true, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to switch back to production
CREATE OR REPLACE FUNCTION switch_to_production_schema()
RETURNS void AS $$
BEGIN
  UPDATE testing.schema_config 
  SET schema_name = 'public', is_testing_mode = false, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get the current active schema
CREATE OR REPLACE FUNCTION get_active_schema()
RETURNS text AS $$
DECLARE
  active_schema text;
BEGIN
  SELECT schema_name INTO active_schema 
  FROM testing.schema_config 
  ORDER BY updated_at DESC 
  LIMIT 1;
  
  RETURN COALESCE(active_schema, 'public');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_current_schema() TO authenticated;
GRANT EXECUTE ON FUNCTION switch_to_testing_schema() TO authenticated;
GRANT EXECUTE ON FUNCTION switch_to_production_schema() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_schema() TO authenticated;
