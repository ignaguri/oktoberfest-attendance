-- Create function to update personal attendance while preserving existing tent visit timestamps
-- This function is used for retrospective attendance corrections via the detailed attendance form
-- It preserves existing tent visits and their timestamps while allowing additions/removals

CREATE OR REPLACE FUNCTION update_personal_attendance_with_tents(
    p_user_id UUID,
    p_date DATE,
    p_beer_count INTEGER,
    p_tent_ids UUID[],
    p_festival_id UUID
)
RETURNS TABLE(attendance_id UUID, tents_added UUID[], tents_removed UUID[]) AS $$
DECLARE
    v_attendance_id UUID;
    v_existing_tent_ids UUID[];
    v_tents_to_add UUID[];
    v_tents_to_remove UUID[];
    v_tent_id UUID;
BEGIN
    -- Update the attendance record
    INSERT INTO attendances (user_id, date, beer_count, festival_id)
    VALUES (p_user_id, p_date, p_beer_count, p_festival_id)
    ON CONFLICT (user_id, date, festival_id)
    DO UPDATE SET beer_count = p_beer_count
    RETURNING id INTO v_attendance_id;

    -- If no tent IDs provided, just return (tent-less attendance)
    IF p_tent_ids IS NULL OR array_length(p_tent_ids, 1) IS NULL THEN
        RETURN QUERY SELECT v_attendance_id, ARRAY[]::UUID[], ARRAY[]::UUID[];
        RETURN;
    END IF;

    -- Get existing tent visits for this date
    SELECT array_agg(tent_id ORDER BY visit_date ASC) INTO v_existing_tent_ids
    FROM tent_visits
    WHERE user_id = p_user_id
      AND visit_date::date = p_date
      AND festival_id = p_festival_id;

    IF v_existing_tent_ids IS NULL THEN
        v_existing_tent_ids := ARRAY[]::UUID[];
    END IF;

    -- Determine which tents to add (in new list but not in existing)
    SELECT array_agg(tent_id) INTO v_tents_to_add
    FROM (SELECT unnest(p_tent_ids) AS tent_id EXCEPT SELECT unnest(v_existing_tent_ids)) AS diff;

    -- Determine which tents to remove (in existing but not in new list)
    SELECT array_agg(tent_id) INTO v_tents_to_remove
    FROM (SELECT unnest(v_existing_tent_ids) AS tent_id EXCEPT SELECT unnest(p_tent_ids)) AS diff;

    -- Remove tent visits that are no longer in the list
    IF array_length(v_tents_to_remove, 1) > 0 THEN
        DELETE FROM tent_visits
        WHERE user_id = p_user_id
          AND tent_id = ANY(v_tents_to_remove)
          AND visit_date::date = p_date
          AND festival_id = p_festival_id;
    END IF;

    -- Add new tent visits with current timestamp (since this is a retrospective correction)
    IF array_length(v_tents_to_add, 1) > 0 THEN
        FOREACH v_tent_id IN ARRAY v_tents_to_add
        LOOP
            INSERT INTO tent_visits (id, user_id, tent_id, visit_date, festival_id)
            VALUES (uuid_generate_v4(), p_user_id, v_tent_id, now(), p_festival_id);
        END LOOP;
    END IF;

    RETURN QUERY SELECT v_attendance_id, v_tents_to_add, v_tents_to_remove;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the function's purpose
COMMENT ON FUNCTION update_personal_attendance_with_tents(UUID, DATE, INTEGER, UUID[], UUID) IS
'Updates personal attendance records while preserving existing tent visit timestamps.
Used for retrospective attendance corrections. Returns attendance_id, added tents, and removed tents.';
