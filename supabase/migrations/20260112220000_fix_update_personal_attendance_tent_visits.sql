-- Fix update_personal_attendance_with_tents to:
-- 1. Accept timestamp with time zone instead of date (preserve time)
-- 2. Never delete existing tent visits (accumulate instead)
-- 3. Prevent duplicate consecutive visits (like v3)

DROP FUNCTION IF EXISTS "public"."update_personal_attendance_with_tents"("uuid", "date", integer, "uuid"[], "uuid");

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
    v_last_tent_id UUID;
    v_tents_to_add UUID[];
    v_tent_id UUID;
BEGIN
    -- Update the attendance record (use date part for the attendance record)
    INSERT INTO attendances (user_id, date, beer_count, festival_id)
    VALUES (p_user_id, p_date::date, p_beer_count, p_festival_id)
    ON CONFLICT (user_id, date, festival_id)
    DO UPDATE SET beer_count = p_beer_count
    RETURNING id INTO v_attendance_id;

    -- If no tent IDs provided, just return (tent-less attendance)
    IF p_tent_ids IS NULL OR array_length(p_tent_ids, 1) IS NULL THEN
        RETURN QUERY SELECT v_attendance_id, ARRAY[]::UUID[], ARRAY[]::UUID[];
        RETURN;
    END IF;

    -- Get existing tent visits for this date (ordered by visit time, most recent first)
    SELECT array_agg(tent_id ORDER BY visit_date DESC) INTO v_existing_tent_ids
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

    -- Determine which tents to add (in new list but either:
    -- 1. Not visited at all today, OR
    -- 2. Different from the last visited tent)
    v_tents_to_add := ARRAY[]::UUID[];

    -- Insert new tent visits with full timestamp (preserving time)
    -- Only add if this tent is different from the last tent visited
    FOREACH v_tent_id IN ARRAY p_tent_ids
    LOOP
        IF v_last_tent_id IS NULL OR v_tent_id != v_last_tent_id THEN
            INSERT INTO tent_visits (id, user_id, tent_id, visit_date, festival_id)
            VALUES (uuid_generate_v4(), p_user_id, v_tent_id, p_date, p_festival_id);
            v_tents_to_add := array_append(v_tents_to_add, v_tent_id);
        END IF;
    END LOOP;

    -- Note: We intentionally do NOT delete any tent visits
    -- Tent visits accumulate over the day to preserve check-in history
    RETURN QUERY SELECT v_attendance_id, v_tents_to_add, ARRAY[]::UUID[];
END;
$$;

ALTER FUNCTION "public"."update_personal_attendance_with_tents"("p_user_id" "uuid", "p_date" timestamp with time zone, "p_beer_count" integer, "p_tent_ids" "uuid"[], "p_festival_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."update_personal_attendance_with_tents"("p_user_id" "uuid", "p_date" timestamp with time zone, "p_beer_count" integer, "p_tent_ids" "uuid"[], "p_festival_id" "uuid") IS 'Updates personal attendance records while accumulating tent visits (never deletes).
Preserves full timestamps for tent visits. Prevents duplicate consecutive tent visits.
Returns attendance_id, added tents (removed tents is always empty as we dont delete).';

-- Grant permissions
GRANT ALL ON FUNCTION "public"."update_personal_attendance_with_tents"("p_user_id" "uuid", "p_date" timestamp with time zone, "p_beer_count" integer, "p_tent_ids" "uuid"[], "p_festival_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_personal_attendance_with_tents"("p_user_id" "uuid", "p_date" timestamp with time zone, "p_beer_count" integer, "p_tent_ids" "uuid"[], "p_festival_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_personal_attendance_with_tents"("p_user_id" "uuid", "p_date" timestamp with time zone, "p_beer_count" integer, "p_tent_ids" "uuid"[], "p_festival_id" "uuid") TO "service_role";
