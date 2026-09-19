-- Let an offline client choose the attendance row's id.
--
-- push-handlers sends a locally created day through updatePersonal, which had
-- no way to carry an id, so the server minted its own. The device kept its
-- local uuid until a later pull reconciled it, and a DELETE queued in between
-- travelled with that local id - one the server had never seen. The delete
-- route treats an unknown id as idempotent success, so it answered 200 and
-- removed nothing, and the next pull brought the deleted day back.
--
-- sync() pulls before it pushes, so a day created and deleted in one offline
-- window sends both operations in the same push run with no pull between them
-- to heal the id. That is the window this closes.
--
-- consumptions and tent_visits already accept a client-supplied id for exactly
-- this reason. attendances was the one write that did not.
--
-- p_attendance_id comes last and defaults to NULL so the currently deployed
-- 5-argument callers keep working while the API rolls out. The old signature is
-- dropped rather than left in place: with a defaulted sixth argument both would
-- match a 5-argument call and Postgres would reject it as ambiguous.

DROP FUNCTION IF EXISTS "public"."update_personal_attendance_with_tents"(
    "uuid", timestamp with time zone, integer, "uuid"[], "uuid"
);

CREATE OR REPLACE FUNCTION "public"."update_personal_attendance_with_tents"(
    "p_user_id" "uuid",
    "p_date" timestamp with time zone,
    "p_beer_count" integer,
    "p_tent_ids" "uuid"[],
    "p_festival_id" "uuid",
    "p_attendance_id" "uuid" DEFAULT NULL
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
    -- Update the attendance record (no longer writing beer_count).
    -- A client-supplied id is used only when this call creates the row. On
    -- conflict the stored id is returned unchanged: a day the server already
    -- has is authoritative, and the caller reconciles to what comes back.
    INSERT INTO attendances (id, user_id, date, festival_id)
    VALUES (COALESCE(p_attendance_id, uuid_generate_v4()), p_user_id, p_date::date, p_festival_id)
    ON CONFLICT (user_id, date, festival_id)
    DO UPDATE SET updated_at = now()
    RETURNING id INTO v_attendance_id;

    -- Nothing supplied: touch the attendance row only, leave tent visits alone.
    IF p_tent_ids IS NULL THEN
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

    IF v_unique_existing_tent_ids IS NULL THEN
        v_unique_existing_tent_ids := ARRAY[]::UUID[];
    END IF;

    -- Explicitly cleared: remove every tent visit for this date, and report it.
    IF array_length(p_tent_ids, 1) IS NULL THEN
        DELETE FROM tent_visits
        WHERE user_id = p_user_id
          AND visit_date::date = p_date::date
          AND festival_id = p_festival_id;

        RETURN QUERY SELECT v_attendance_id, ARRAY[]::UUID[], v_unique_existing_tent_ids;
        RETURN;
    END IF;

    -- Get the last tent ID if any exist (most recent visit)
    IF v_existing_tent_ids IS NOT NULL AND array_length(v_existing_tent_ids, 1) > 0 THEN
        v_last_tent_id := v_existing_tent_ids[1];
    END IF;

    IF v_existing_tent_ids IS NULL THEN
        v_existing_tent_ids := ARRAY[]::UUID[];
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
                -- Only add if this tent isn't already in the existing visits, and not
                -- already inserted earlier in this same call. p_tent_ids is a set to
                -- reconcile to, but nothing upstream guarantees it is distinct, and
                -- tent_visits has no unique index on
                -- (user_id, tent_id, festival_id, visit_date) - so without this guard
                -- a duplicated id silently writes two rows and reports the tent twice
                -- in tents_added.
                IF NOT (v_tent_id = ANY(v_unique_existing_tent_ids))
                   AND NOT (v_tent_id = ANY(v_tents_to_add)) THEN
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

ALTER FUNCTION "public"."update_personal_attendance_with_tents"("p_user_id" "uuid", "p_date" timestamp with time zone, "p_beer_count" integer, "p_tent_ids" "uuid"[], "p_festival_id" "uuid", "p_attendance_id" "uuid") OWNER TO "postgres";

-- DROP FUNCTION discarded the old grants along with the function.
GRANT ALL ON FUNCTION "public"."update_personal_attendance_with_tents"("p_user_id" "uuid", "p_date" timestamp with time zone, "p_beer_count" integer, "p_tent_ids" "uuid"[], "p_festival_id" "uuid", "p_attendance_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_personal_attendance_with_tents"("p_user_id" "uuid", "p_date" timestamp with time zone, "p_beer_count" integer, "p_tent_ids" "uuid"[], "p_festival_id" "uuid", "p_attendance_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_personal_attendance_with_tents"("p_user_id" "uuid", "p_date" timestamp with time zone, "p_beer_count" integer, "p_tent_ids" "uuid"[], "p_festival_id" "uuid", "p_attendance_id" "uuid") TO "service_role";

COMMENT ON FUNCTION "public"."update_personal_attendance_with_tents"("p_user_id" "uuid", "p_date" timestamp with time zone, "p_beer_count" integer, "p_tent_ids" "uuid"[], "p_festival_id" "uuid", "p_attendance_id" "uuid") IS 'Updates personal attendance records with tent visit management.
Supports adding new tents and removing deselected tents.
Preserves full timestamps for tent visits. Prevents duplicate consecutive tent visits.
p_tent_ids NULL leaves tent visits untouched; an empty array clears them for the date.
p_attendance_id sets the id when this call creates the row, so an offline client keeps
the id it already queued operations against; on conflict the stored id is returned.
Returns attendance_id, added tents, and removed tents.
Note: p_beer_count is kept for backwards compatibility but is no longer written to the attendances table.';
