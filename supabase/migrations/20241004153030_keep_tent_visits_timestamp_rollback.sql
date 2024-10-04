CREATE
OR REPLACE FUNCTION add_or_update_attendance_with_tents (
  p_user_id UUID,
  p_date TIMESTAMPTZ,
  p_beer_count INTEGER,
  p_tent_ids UUID[]
) RETURNS UUID AS $$
DECLARE
    v_tent_id UUID;
    v_attendance_id UUID;
BEGIN
    -- Insert or update the attendance record
    INSERT INTO attendances (user_id, date, beer_count)
    VALUES (p_user_id, p_date::date, p_beer_count)
    ON CONFLICT (user_id, date)
    DO UPDATE SET beer_count = p_beer_count
    RETURNING id INTO v_attendance_id;

    -- Delete existing tent visits for this user and date
    DELETE FROM tent_visits
    WHERE user_id = p_user_id AND visit_date::date = p_date::date;

    -- Insert new tent visits with manually generated UUIDs
    FOREACH v_tent_id IN ARRAY p_tent_ids
    LOOP
        INSERT INTO tent_visits (id, user_id, tent_id, visit_date)
        VALUES (uuid_generate_v4(), p_user_id, v_tent_id, p_date);
    END LOOP;

    RETURN v_attendance_id;
END;
$$ LANGUAGE plpgsql;
