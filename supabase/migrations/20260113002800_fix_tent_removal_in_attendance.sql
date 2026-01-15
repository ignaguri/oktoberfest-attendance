-- Fix update_personal_attendance_with_tents to support removing tents
-- Previously the function never deleted tent visits, now it properly removes
-- tents that are no longer in the selected list

CREATE OR REPLACE FUNCTION "public"."update_personal_attendance_with_tents"(
    "p_user_id" "uuid",
    "p_date" timestamp with time zone,
    "p_beer_count" integer,
    "p_tent_ids" "uuid"[],
    "p_festival_id" "uuid"
) RETURNS TABLE("attendance_id" "uuid", "tents_added" "uuid"[], "tents_removed" "uuid"[])
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_attendance_id UUID;
    v_existing_tent_ids UUID[];
    v_unique_existing_tent_ids UUID[];
    v_last_tent_id UUID;
    v_tents_to_add UUID[];
    v_tents_to_remove UUID[];
    v_tent_id UUID;
BEGIN
    -- Update the attendance record (use date part for the attendance record)
    INSERT INTO attendances (user_id, date, beer_count, festival_id)
    VALUES (p_user_id, p_date::date, p_beer_count, p_festival_id)
    ON CONFLICT (user_id, date, festival_id)
    DO UPDATE SET beer_count = p_beer_count
    RETURNING id INTO v_attendance_id;

    -- Handle empty tent array - delete all tent visits for this date
    IF p_tent_ids IS NULL OR array_length(p_tent_ids, 1) IS NULL THEN
        -- Delete all tent visits for this date
        DELETE FROM tent_visits
        WHERE user_id = p_user_id
          AND visit_date::date = p_date::date
          AND festival_id = p_festival_id;

        RETURN QUERY SELECT v_attendance_id, ARRAY[]::UUID[], ARRAY[]::UUID[];
        RETURN;
    END IF;

    -- Get existing tent visits for this date (ordered by visit time, most recent first)
    SELECT array_agg(tent_id ORDER BY visit_date DESC) INTO v_existing_tent_ids
    FROM tent_visits
    WHERE user_id = p_user_id
      AND visit_date::date = p_date::date
      AND festival_id = p_festival_id;

    -- Get unique tent IDs from existing visits
    SELECT array_agg(DISTINCT tent_id) INTO v_unique_existing_tent_ids
    FROM tent_visits
    WHERE user_id = p_user_id
      AND visit_date::date = p_date::date
      AND festival_id = p_festival_id;

    -- Get the last tent ID if any exist (most recent visit)
    IF v_existing_tent_ids IS NOT NULL AND array_length(v_existing_tent_ids, 1) > 0 THEN
        v_last_tent_id := v_existing_tent_ids[1];
    END IF;

    IF v_existing_tent_ids IS NULL THEN
        v_existing_tent_ids := ARRAY[]::UUID[];
    END IF;

    IF v_unique_existing_tent_ids IS NULL THEN
        v_unique_existing_tent_ids := ARRAY[]::UUID[];
    END IF;

    -- Determine which tents to remove (in existing but not in new list)
    v_tents_to_remove := ARRAY[]::UUID[];
    FOREACH v_tent_id IN ARRAY v_unique_existing_tent_ids
    LOOP
        IF NOT (v_tent_id = ANY(p_tent_ids)) THEN
            v_tents_to_remove := array_append(v_tents_to_remove, v_tent_id);
        END IF;
    END LOOP;

    -- Delete tent visits for removed tents (all visits for that tent on this date)
    IF array_length(v_tents_to_remove, 1) > 0 THEN
        DELETE FROM tent_visits
        WHERE user_id = p_user_id
          AND visit_date::date = p_date::date
          AND festival_id = p_festival_id
          AND tent_id = ANY(v_tents_to_remove);
    END IF;

    -- Determine which tents to add
    v_tents_to_add := ARRAY[]::UUID[];

    -- Insert new tent visits with full timestamp (preserving time)
    -- Only add if this tent is different from the last tent visited
    FOREACH v_tent_id IN ARRAY p_tent_ids
    LOOP
        IF v_last_tent_id IS NULL OR v_tent_id != v_last_tent_id THEN
            -- Check if we just removed this tent - if so, skip adding to avoid immediate re-add
            IF NOT (v_tent_id = ANY(v_tents_to_remove)) THEN
                -- Only add if this tent isn't already in the existing visits
                IF NOT (v_tent_id = ANY(v_unique_existing_tent_ids)) THEN
                    INSERT INTO tent_visits (id, user_id, tent_id, visit_date, festival_id)
                    VALUES (uuid_generate_v4(), p_user_id, v_tent_id, p_date, p_festival_id);
                    v_tents_to_add := array_append(v_tents_to_add, v_tent_id);
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_attendance_id, v_tents_to_add, v_tents_to_remove;
END;
$$;

COMMENT ON FUNCTION "public"."update_personal_attendance_with_tents"("p_user_id" "uuid", "p_date" timestamp with time zone, "p_beer_count" integer, "p_tent_ids" "uuid"[], "p_festival_id" "uuid") IS 'Updates personal attendance records with tent visit management.
Supports adding new tents and removing deselected tents.
Preserves full timestamps for tent visits. Prevents duplicate consecutive tent visits.
Returns attendance_id, added tents, and removed tents.';
