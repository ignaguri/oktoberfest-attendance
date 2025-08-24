-- Cleanup testing schema when testing is complete
-- This migration removes all testing data and schema without affecting production

-- First, switch back to production mode
SELECT switch_to_production_schema();

-- Drop all testing tables (CASCADE will handle dependencies)
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

-- Drop testing views
DROP VIEW IF EXISTS testing.results;
DROP VIEW IF EXISTS testing.schema_status;

-- Drop testing functions
DROP FUNCTION IF EXISTS testing.handle_new_user();
DROP FUNCTION IF EXISTS testing.switch_to_testing_schema();
DROP FUNCTION IF EXISTS testing.switch_to_production_schema();
DROP FUNCTION IF EXISTS testing.get_active_schema();

-- Drop the testing schema entirely
DROP SCHEMA IF EXISTS testing CASCADE;

-- Note: The schema_config table and related functions in the public schema
-- will remain for future testing cycles. If you want to remove them completely,
-- uncomment the following lines:

-- DROP TABLE IF EXISTS public.schema_config;
-- DROP FUNCTION IF EXISTS get_current_schema();
-- DROP FUNCTION IF EXISTS switch_to_testing_schema();
-- DROP FUNCTION IF EXISTS switch_to_production_schema();
-- DROP FUNCTION IF EXISTS get_active_schema();
