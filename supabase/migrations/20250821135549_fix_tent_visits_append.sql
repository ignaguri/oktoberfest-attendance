-- Fix tent visits to append instead of replace
-- This fixes the issue where checking into different tents overwrites existing tent visits

-- Drop the old function first since we're changing parameter order
DROP FUNCTION IF EXISTS add_or_update_attendance_with_tents(UUID, UUID, TIMESTAMPTZ, INTEGER, UUID[]);
DROP FUNCTION IF EXISTS add_or_update_attendance_with_tents(UUID, UUID, DATE, INTEGER, UUID[]);

CREATE OR REPLACE FUNCTION add_or_update_attendance_with_tents(
  p_user_id UUID,
  p_festival_id UUID,
  p_beer_count INTEGER,
  p_tent_ids UUID[],
  p_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
  v_tent_id UUID;
  v_attendance_id UUID;
BEGIN
  -- Insert or update the attendance record
  INSERT INTO attendances (user_id, festival_id, date, beer_count)
  VALUES (p_user_id, p_festival_id, p_date, p_beer_count)
  ON CONFLICT (user_id, date, festival_id)
  DO UPDATE SET beer_count = p_beer_count
  RETURNING id INTO v_attendance_id;

  -- Insert new tent visits (allowing multiple visits to the same tent on the same day)
  -- Note: We don't delete existing tent visits, so they accumulate over the day
  FOREACH v_tent_id IN ARRAY p_tent_ids
  LOOP
    INSERT INTO tent_visits (id, user_id, festival_id, tent_id, visit_date)
    VALUES (uuid_generate_v4(), p_user_id, p_festival_id, v_tent_id, p_date);
  END LOOP;

  RETURN v_attendance_id;
END;
$$ LANGUAGE plpgsql;
