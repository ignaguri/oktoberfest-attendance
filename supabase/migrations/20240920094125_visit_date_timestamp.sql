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

DROP FUNCTION IF EXISTS add_or_update_attendance_with_tents(UUID, DATE, INTEGER, UUID[]);
DROP FUNCTION IF EXISTS add_or_update_attendance_with_tents(UUID, TIMESTAMPTZ, INTEGER, UUID[]);

CREATE OR REPLACE FUNCTION add_or_update_attendance_with_tents(
    p_user_id UUID,
    p_date TIMESTAMPTZ,
    p_beer_count INTEGER,
    p_tent_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
  v_tent_id UUID;
BEGIN
  -- Insert or update the attendance record
  INSERT INTO attendances (user_id, date, beer_count)
  VALUES (p_user_id, p_date::date, p_beer_count)
  ON CONFLICT (user_id, date)
  DO UPDATE SET beer_count = p_beer_count;

  -- Delete existing tent visits for this date
  DELETE FROM tent_visits
  WHERE user_id = p_user_id AND visit_date::date = p_date::date;

  -- Insert new tent visits
  FOREACH v_tent_id IN ARRAY p_tent_ids
  LOOP
    INSERT INTO tent_visits (id, user_id, tent_id, visit_date)
    VALUES (uuid_generate_v4(), p_user_id, v_tent_id, p_date);
  END LOOP;
END;
$$ LANGUAGE plpgsql;
