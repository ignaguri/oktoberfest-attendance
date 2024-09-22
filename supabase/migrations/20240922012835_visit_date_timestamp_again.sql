BEGIN;

-- Step 1: Add a new column with timestamp type
ALTER TABLE tent_visits ADD COLUMN visit_date_temp timestamp with time zone;

-- Step 2: Copy the date data to the new column, setting the time to midnight
UPDATE tent_visits
SET visit_date_temp = visit_date::timestamp AT TIME ZONE 'UTC+1';

-- Step 3: Drop the old column
ALTER TABLE tent_visits DROP COLUMN visit_date;

-- Step 4: Rename the new column to the original column name
ALTER TABLE tent_visits RENAME COLUMN visit_date_temp TO visit_date;

COMMIT;
