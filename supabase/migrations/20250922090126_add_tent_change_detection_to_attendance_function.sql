-- Add tent change detection to attendance function
-- This creates a new version of the function that returns both attendance_id and tents_changed flag

CREATE OR REPLACE FUNCTION add_or_update_attendance_with_tents_v2(
    p_user_id UUID,
    p_date TIMESTAMPTZ,
    p_beer_count INTEGER,
    p_tent_ids UUID[]
)
RETURNS TABLE(attendance_id UUID, tents_changed BOOLEAN) AS $$
DECLARE
    v_tent_id UUID;
    v_attendance_id UUID;
    v_existing_tent_ids UUID[];
    v_tents_changed BOOLEAN := FALSE;
BEGIN
    -- Insert or update the attendance record
    INSERT INTO attendances (user_id, date, beer_count)
    VALUES (p_user_id, p_date::date, p_beer_count)
    ON CONFLICT (user_id, date)
    DO UPDATE SET beer_count = p_beer_count
    RETURNING id INTO v_attendance_id;

    -- Fetch existing tent visits for the user and date
    SELECT array_agg(tent_id) INTO v_existing_tent_ids
    FROM tent_visits
    WHERE user_id = p_user_id AND visit_date::date = p_date::date;

    -- Check if tents have changed by comparing arrays
    IF v_existing_tent_ids IS NULL THEN
        v_existing_tent_ids := ARRAY[]::UUID[];
    END IF;
    
    -- Check if the arrays are different
    IF NOT (v_existing_tent_ids <@ p_tent_ids AND p_tent_ids <@ v_existing_tent_ids) THEN
        v_tents_changed := TRUE;
    END IF;

    -- Delete tent visits that are not in the new list of tent IDs
    DELETE FROM tent_visits
    WHERE user_id = p_user_id AND visit_date::date = p_date::date
    AND tent_id != ALL(p_tent_ids);

    -- Insert new tent visits with manually generated UUIDs
    FOREACH v_tent_id IN ARRAY p_tent_ids
    LOOP
        IF v_tent_id != ALL(v_existing_tent_ids) THEN
            INSERT INTO tent_visits (id, user_id, tent_id, visit_date)
            VALUES (uuid_generate_v4(), p_user_id, v_tent_id, p_date);
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_attendance_id, v_tents_changed;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the function's purpose
COMMENT ON FUNCTION add_or_update_attendance_with_tents_v2(UUID, TIMESTAMPTZ, INTEGER, UUID[]) IS 
'Enhanced version of add_or_update_attendance_with_tents that returns both attendance_id and tents_changed flag. 
Used to determine if tent notifications should be sent when attendance is updated.';
