-- Fix attendance tent logic issues
-- This migration fixes the add_or_update_attendance_with_tents_v2 function to:
-- 1. Handle empty tent arrays properly (don't delete existing tent visits)
-- 2. Check for last tent duplication before inserting
-- 3. Support tent-less attendance scenarios

CREATE OR REPLACE FUNCTION add_or_update_attendance_with_tents_v3(
    p_user_id UUID,
    p_date TIMESTAMPTZ,
    p_beer_count INTEGER,
    p_tent_ids UUID[],
    p_festival_id UUID
)
RETURNS TABLE(attendance_id UUID, tents_changed BOOLEAN) AS $$
DECLARE
    v_tent_id UUID;
    v_attendance_id UUID;
    v_existing_tent_ids UUID[];
    v_last_tent_id UUID;
    v_tents_changed BOOLEAN := FALSE;
BEGIN
    -- Insert or update the attendance record
    INSERT INTO attendances (user_id, date, beer_count, festival_id)
    VALUES (p_user_id, p_date::date, p_beer_count, p_festival_id)
    ON CONFLICT (user_id, date, festival_id)
    DO UPDATE SET beer_count = p_beer_count
    RETURNING id INTO v_attendance_id;

    -- If no tent IDs provided, just return (tent-less attendance)
    IF p_tent_ids IS NULL OR array_length(p_tent_ids, 1) IS NULL THEN
        RETURN QUERY SELECT v_attendance_id, FALSE;
        RETURN;
    END IF;

    -- Fetch existing tent visits for the user and date
    SELECT array_agg(tent_id ORDER BY visit_date DESC) INTO v_existing_tent_ids
    FROM tent_visits
    WHERE user_id = p_user_id
      AND visit_date::date = p_date::date
      AND festival_id = p_festival_id;

    -- Get the last tent ID if any exist
    IF v_existing_tent_ids IS NOT NULL AND array_length(v_existing_tent_ids, 1) > 0 THEN
        v_last_tent_id := v_existing_tent_ids[1];
    END IF;

    -- Check if any of the new tents are different from existing ones
    IF v_existing_tent_ids IS NULL THEN
        v_existing_tent_ids := ARRAY[]::UUID[];
    END IF;

    -- Check if the arrays are different (any new tent not in existing)
    IF NOT (p_tent_ids <@ v_existing_tent_ids) THEN
        v_tents_changed := TRUE;
    END IF;

    -- Insert new tent visits, but skip if the tent is the same as the last one
    FOREACH v_tent_id IN ARRAY p_tent_ids
    LOOP
        -- Only insert if this tent is different from the last tent visited
        IF v_last_tent_id IS NULL OR v_tent_id != v_last_tent_id THEN
            INSERT INTO tent_visits (id, user_id, tent_id, visit_date, festival_id)
            VALUES (uuid_generate_v4(), p_user_id, v_tent_id, p_date, p_festival_id);
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_attendance_id, v_tents_changed;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the function's purpose
COMMENT ON FUNCTION add_or_update_attendance_with_tents_v3(UUID, TIMESTAMPTZ, INTEGER, UUID[], UUID) IS
'Fixed version that handles empty tent arrays properly and prevents duplicate consecutive tent visits.
Supports tent-less attendance scenarios and returns both attendance_id and tents_changed flag.';

-- Create helper function for basic attendance upsert (shared between functions)
CREATE OR REPLACE FUNCTION upsert_attendance_record(
    p_user_id UUID,
    p_date DATE,
    p_beer_count INTEGER,
    p_festival_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_attendance_id UUID;
BEGIN
    INSERT INTO attendances (user_id, date, beer_count, festival_id)
    VALUES (p_user_id, p_date, p_beer_count, p_festival_id)
    ON CONFLICT (user_id, date, festival_id)
    DO UPDATE SET beer_count = p_beer_count
    RETURNING id INTO v_attendance_id;

    RETURN v_attendance_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_attendance_record(UUID, DATE, INTEGER, UUID) IS
'Shared utility function for upserting attendance records without tent logic.';