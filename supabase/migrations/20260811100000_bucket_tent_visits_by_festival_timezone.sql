-- Derive the day a tent visit belongs to in the festival's timezone, not UTC.
--
-- tent_visits.visit_date is a timestamptz and every consumer bucketed it with
-- `visit_date::date`, which resolves in UTC. Oktoberfest runs in CEST (UTC+2),
-- so for the two hours after local midnight the server and the user disagreed
-- about what day it was: a visit logged at 00:30 on 21 Sep was stored as
-- 22:30Z on the 20th and filed under the 20th. The user saw a success response
-- and then no visit, because the 21st's queries could not see it. Log a drink
-- in that window and the tent was missing from the day; open the 21st's form
-- and save, and the reconcile - blind to the visit it could not see - wrote a
-- second row for the same real visit, in a second day bucket.
--
-- Every function that buckets visit_date now reads the day in
-- festivals.timezone (NOT NULL DEFAULT 'Europe/Berlin'). The pattern already
-- existed in this schema for reservations: see the reservation-to-attendance
-- join, `a.date = DATE(r.start_at AT TIME ZONE f.timezone)`.
--
-- The two write paths also stop stamping new visits at midnight UTC.
-- `p_date` arrives as a bare date, so `'2026-09-21'::timestamptz` is midnight
-- in the *session* timezone; in a festival west of UTC that instant belongs to
-- the previous local day, and the reconcile would not have found the rows it
-- had just written. Visits written by the form now carry local midnight in the
-- festival's own timezone, which round-trips through the new bucket in every
-- timezone.
--
-- They are also staggered by a millisecond each. Every tent selected in one
-- save previously got a visit_date identical to the millisecond, leaving
-- nothing to order them by - which matters now that "the tent you are in" is
-- defined as the latest visit, and made that answer depend on whichever row
-- the database happened to return last.
--
-- No backfill. Bucketing is computed at read time, so existing rows are
-- reinterpreted rather than rewritten: a visit already stored inside the window
-- moves to the day the user meant. Attendance rows that only exist because a
-- visit was misfiled are left in place; they are empty days, not wrong data.
--
-- Behaviour otherwise preserved, including the omitted-vs-empty p_tent_ids
-- contract from 20260810120000.

-- 1. update_personal_attendance_with_tents
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
    v_timezone TEXT;
    v_day DATE;
    v_day_start TIMESTAMPTZ;
    v_added_count INTEGER := 0;
BEGIN
    -- The festival's timezone decides which day a visit falls in. Read before
    -- any tent_visits access below, all of which depend on it.
    SELECT timezone INTO v_timezone FROM festivals WHERE id = p_festival_id;
    IF v_timezone IS NULL THEN
        RAISE EXCEPTION 'Festival not found: %', p_festival_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- p_date carries a bare date, so its ::date is the calendar day the caller
    -- meant under any session timezone. v_day_start is that day's local
    -- midnight in the festival's timezone, which is what new rows are stamped
    -- with so they bucket back to v_day.
    v_day := p_date::date;
    v_day_start := (v_day::timestamp) AT TIME ZONE v_timezone;

    -- Update the attendance record (no longer writing beer_count)
    INSERT INTO attendances (user_id, date, festival_id)
    VALUES (p_user_id, v_day, p_festival_id)
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
      AND (visit_date AT TIME ZONE v_timezone)::date = v_day
      AND festival_id = p_festival_id;

    -- Get unique tent IDs from existing visits
    SELECT array_agg(DISTINCT tent_id) INTO v_unique_existing_tent_ids
    FROM tent_visits
    WHERE user_id = p_user_id
      AND (visit_date AT TIME ZONE v_timezone)::date = v_day
      AND festival_id = p_festival_id;

    IF v_unique_existing_tent_ids IS NULL THEN
        v_unique_existing_tent_ids := ARRAY[]::UUID[];
    END IF;

    -- Explicitly cleared: remove every tent visit for this date, and report it.
    IF array_length(p_tent_ids, 1) IS NULL THEN
        DELETE FROM tent_visits
        WHERE user_id = p_user_id
          AND (visit_date AT TIME ZONE v_timezone)::date = v_day
          AND festival_id = p_festival_id;

        RETURN QUERY SELECT v_attendance_id, ARRAY[]::UUID[], v_unique_existing_tent_ids;
        RETURN;
    END IF;

    -- Get the last tent ID if any exist
    IF v_existing_tent_ids IS NOT NULL AND array_length(v_existing_tent_ids, 1) > 0 THEN
        v_last_tent_id := v_existing_tent_ids[1];
    END IF;

    -- Determine which tents to remove
    v_tents_to_remove := ARRAY(
        SELECT unnest(v_unique_existing_tent_ids)
        EXCEPT
        SELECT unnest(p_tent_ids)
    );

    IF array_length(v_tents_to_remove, 1) > 0 THEN
        DELETE FROM tent_visits
        WHERE user_id = p_user_id
          AND (visit_date AT TIME ZONE v_timezone)::date = v_day
          AND festival_id = p_festival_id
          AND tent_id = ANY(v_tents_to_remove);
    END IF;

    -- Determine which tents to add
    v_tents_to_add := ARRAY[]::UUID[];

    -- Insert new tent visits at the day's local midnight, one millisecond apart
    -- so several tents added in one save stay orderable.
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
                    VALUES (
                        gen_random_uuid(),
                        p_user_id,
                        v_tent_id,
                        v_day_start + (v_added_count * INTERVAL '1 millisecond'),
                        p_festival_id
                    );
                    v_tents_to_add := array_append(v_tents_to_add, v_tent_id);
                    v_added_count := v_added_count + 1;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_attendance_id, v_tents_to_add, v_tents_to_remove;
END;
$$;

-- 2. add_or_update_attendance_with_tents
CREATE OR REPLACE FUNCTION "public"."add_or_update_attendance_with_tents"(
    "p_user_id" "uuid",
    "p_date" timestamp with time zone,
    "p_beer_count" integer,
    "p_tent_ids" "uuid"[],
    "p_festival_id" "uuid"
) RETURNS TABLE("attendance_id" "uuid", "tents_changed" boolean)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_tent_id UUID;
    v_attendance_id UUID;
    v_existing_tent_ids UUID[];
    v_last_tent_id UUID;
    v_tents_changed BOOLEAN := FALSE;
    v_timezone TEXT;
    v_day DATE;
    v_day_start TIMESTAMPTZ;
    v_added_count INTEGER := 0;
BEGIN
    SELECT timezone INTO v_timezone FROM festivals WHERE id = p_festival_id;
    IF v_timezone IS NULL THEN
        RAISE EXCEPTION 'Festival not found: %', p_festival_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    v_day := p_date::date;
    v_day_start := (v_day::timestamp) AT TIME ZONE v_timezone;

    -- Insert or update the attendance record (no longer writing beer_count)
    INSERT INTO attendances (user_id, date, festival_id)
    VALUES (p_user_id, v_day, p_festival_id)
    ON CONFLICT (user_id, date, festival_id)
    DO UPDATE SET updated_at = now()
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
      AND (visit_date AT TIME ZONE v_timezone)::date = v_day
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
            VALUES (
                gen_random_uuid(),
                p_user_id,
                v_tent_id,
                v_day_start + (v_added_count * INTERVAL '1 millisecond'),
                p_festival_id
            );
            v_added_count := v_added_count + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_attendance_id, v_tents_changed;
END;
$$;

-- 3. calculate_attendance_cost
CREATE OR REPLACE FUNCTION "public"."calculate_attendance_cost"("p_attendance_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total_cost DECIMAL(10,2) := 0;
  v_beer_count INTEGER;
  v_festival_id UUID;
  v_attendance_date DATE;
  v_user_id UUID;
  v_timezone TEXT;
BEGIN
  -- Get attendance details, and the festival timezone that decides which day a
  -- tent visit belongs to.
  SELECT a.beer_count, a.festival_id, a.date, a.user_id, f.timezone
  INTO v_beer_count, v_festival_id, v_attendance_date, v_user_id, v_timezone
  FROM attendances a
  JOIN festivals f ON f.id = a.festival_id
  WHERE a.id = p_attendance_id;

  -- If user visited tents, calculate cost based on tent visits and their specific pricing
  -- Use average price if multiple tents visited
  SELECT COALESCE(AVG(ftp.beer_price), 0) * v_beer_count
  INTO v_total_cost
  FROM tent_visits tv
  JOIN festival_tent_pricing ftp ON tv.tent_id = ftp.tent_id
    AND ftp.festival_id = v_festival_id
    AND (ftp.price_start_date IS NULL OR ftp.price_start_date <= v_attendance_date)
    AND (ftp.price_end_date IS NULL OR ftp.price_end_date >= v_attendance_date)
  WHERE tv.user_id = v_user_id
    AND tv.festival_id = v_festival_id
    AND (tv.visit_date AT TIME ZONE v_timezone)::date = v_attendance_date;

  -- Fallback: if no tent visits recorded, use festival average price
  IF v_total_cost = 0 THEN
    SELECT COALESCE(AVG(ftp.beer_price), 16.2) * v_beer_count
    INTO v_total_cost
    FROM festival_tent_pricing ftp
    WHERE ftp.festival_id = v_festival_id
      AND (ftp.price_start_date IS NULL OR ftp.price_start_date <= v_attendance_date)
      AND (ftp.price_end_date IS NULL OR ftp.price_end_date >= v_attendance_date);
  END IF;

  RETURN v_total_cost;
END;
$$;

-- 4. delete_attendance
--
-- Also gains the festival filter it never had. The tent_visits delete matched on
-- (user, date) alone, so deleting one festival's attendance for a date removed
-- that user's visits to every *other* festival sharing the date. Only reachable
-- with overlapping festivals, which is why it went unnoticed.
CREATE OR REPLACE FUNCTION "public"."delete_attendance"("p_attendance_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_user_id UUID;
    v_festival_id UUID;
    v_date DATE;
    v_timezone TEXT;
BEGIN
    SELECT a.user_id, a.festival_id, a.date, f.timezone
    INTO v_user_id, v_festival_id, v_date, v_timezone
    FROM public.attendances a
    JOIN public.festivals f ON f.id = a.festival_id
    WHERE a.id = p_attendance_id;

    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    -- Delete associated beer pictures
    DELETE FROM public.beer_pictures
    WHERE attendance_id = p_attendance_id;

    -- Delete associated tent visits
    DELETE FROM public.tent_visits
    WHERE user_id = v_user_id
      AND festival_id = v_festival_id
      AND (visit_date AT TIME ZONE v_timezone)::date = v_date;

    -- Delete the attendance entry
    DELETE FROM public.attendances
    WHERE id = p_attendance_id;
END;
$$;

-- 5. get_wrapped_data
--
-- Body reproduced verbatim from 20260806120000 with only the three
-- tent_visits date buckets changed, because CREATE OR REPLACE FUNCTION takes no
-- partial update and plpgsql bodies cannot be patched in place. The rewrite was
-- applied mechanically rather than by hand for exactly that reason. v_festival
-- is already loaded with SELECT * before the first use, so timezone comes free.
CREATE OR REPLACE FUNCTION "public"."get_wrapped_data"("p_user_id" "uuid", "p_festival_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  v_result JSONB := '{}'::JSONB;
  v_festival RECORD;
  v_user RECORD;
  v_basic_stats JSONB;
  v_tent_stats JSONB;
  v_peak_moments JSONB;
  v_social_stats JSONB;
  v_global_positions JSONB;
  v_achievements JSONB;
  v_timeline JSONB;
  v_comparisons JSONB;
  v_personality JSONB;
  v_drink_stats JSONB;
  v_beer_cost DECIMAL(5,2);
BEGIN
  -- SECURITY DEFINER: this function reads across all users to build festival-wide
  -- averages and rankings, so it must not be callable for someone else's user id.
  -- auth.uid() IS NULL means there is no JWT (service_role, or the internal call from
  -- regenerate_wrapped_data_cache), which is allowed; anon is revoked below instead.
  IF auth.uid() IS NOT NULL
     AND p_user_id <> auth.uid()
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized to read wrapped data for another user'
      USING ERRCODE = '42501';
  END IF;

  -- Get festival info
  SELECT * INTO v_festival FROM festivals WHERE id = p_festival_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Festival not found';
  END IF;

  -- Get user profile
  SELECT * INTO v_user FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Get default beer cost from festival or use global default
  v_beer_cost := COALESCE(v_festival.beer_cost, 16.20);

  -- Build user_info
  v_result := jsonb_build_object(
    'user_info', jsonb_build_object(
      'username', v_user.username,
      'full_name', v_user.full_name,
      'avatar_url', v_user.avatar_url
    ),
    'festival_info', jsonb_build_object(
      'name', v_festival.name,
      'start_date', v_festival.start_date,
      'end_date', v_festival.end_date,
      'location', v_festival.location
    )
  );

  -- Calculate basic stats using consumptions (with beer_count fallback)
  WITH attendance_drinks AS (
    SELECT
      a.id,
      a.date,
      _get_effective_drink_count(a.id) AS drink_count
    FROM attendances a
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
  ),
  attendance_agg AS (
    SELECT
      COUNT(DISTINCT ad.date) AS days_attended,
      COALESCE(SUM(ad.drink_count), 0) AS total_beers,
      CASE
        WHEN COUNT(DISTINCT ad.date) > 0 THEN
          ROUND(COALESCE(SUM(ad.drink_count), 0)::NUMERIC / COUNT(DISTINCT ad.date)::NUMERIC, 2)
        ELSE 0
      END AS avg_beers
    FROM attendance_drinks ad
  )
  SELECT jsonb_build_object(
    'total_beers', total_beers,
    'days_attended', days_attended,
    'avg_beers', avg_beers,
    'total_spent', ROUND(total_beers * v_beer_cost, 2),
    'beer_cost', v_beer_cost
  ) INTO v_basic_stats
  FROM attendance_agg;

  v_result := v_result || jsonb_build_object('basic_stats', v_basic_stats);

  -- Calculate tent stats
  WITH tent_stats AS (
    SELECT
      tv.tent_id,
      t.name as tent_name,
      COUNT(*) AS visit_count
    FROM tent_visits tv
    JOIN tents t ON tv.tent_id = t.id
    WHERE tv.user_id = p_user_id
      AND tv.festival_id = p_festival_id
    GROUP BY tv.tent_id, t.name
  ),
  tent_agg AS (
    SELECT
      COUNT(DISTINCT tent_id) AS unique_tents,
      (
        SELECT tent_name
        FROM tent_stats ts
        ORDER BY ts.visit_count DESC, ts.tent_name ASC
        LIMIT 1
      ) AS favorite_tent,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'tent_name', tent_name,
            'visit_count', visit_count
          ) ORDER BY visit_count DESC, tent_name ASC
        )
        FROM tent_stats ts
      ) AS tent_breakdown
    FROM tent_stats
  ),
  tent_total AS (
    SELECT COUNT(*) AS total_tents FROM tents
  )
  SELECT jsonb_build_object(
    'unique_tents', COALESCE(ta.unique_tents, 0),
    'favorite_tent', ta.favorite_tent,
    'tent_diversity_pct', CASE
      WHEN tt.total_tents > 0 THEN ROUND((COALESCE(ta.unique_tents, 0)::NUMERIC / tt.total_tents::NUMERIC) * 100, 1)
      ELSE 0
    END,
    'tent_breakdown', COALESCE(ta.tent_breakdown, '[]'::JSONB)
  ) INTO v_tent_stats
  FROM tent_agg ta, tent_total tt;

  v_result := v_result || jsonb_build_object('tent_stats', v_tent_stats);

  -- Calculate peak moments using consumptions (with beer_count fallback)
  WITH daily_base AS (
    SELECT
      a.date,
      _get_effective_drink_count(a.id) AS drink_count,
      COALESCE(tv.tent_count, 0) as tents_visited
    FROM attendances a
    LEFT JOIN (
      SELECT
        (tv.visit_date AT TIME ZONE v_festival.timezone)::date as date,
        COUNT(DISTINCT tv.tent_id) as tent_count
      FROM tent_visits tv
      WHERE tv.user_id = p_user_id
        AND tv.festival_id = p_festival_id
      GROUP BY (tv.visit_date AT TIME ZONE v_festival.timezone)::date
    ) tv ON a.date = tv.date
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
  ),
  daily_scores AS (
    SELECT
      db.date,
      db.drink_count,
      db.tents_visited,
      (db.drink_count + db.tents_visited) as combined_score,
      ROUND(db.drink_count * v_beer_cost, 2) AS spent
    FROM daily_base db
  ),
  best_day AS (
    SELECT
      ds.date,
      ds.drink_count,
      ds.tents_visited,
      ds.spent
    FROM daily_scores ds
    ORDER BY ds.combined_score DESC, ds.date DESC
    LIMIT 1
  ),
  max_session AS (
    SELECT COALESCE(MAX(ds.drink_count), 0) AS max_beers
    FROM daily_scores ds
  ),
  most_expensive AS (
    SELECT
      ds.date,
      ds.spent AS amount
    FROM daily_scores ds
    ORDER BY ds.spent DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'best_day', CASE
      WHEN bd.date IS NOT NULL THEN
        jsonb_build_object(
          'date', bd.date,
          'beer_count', bd.drink_count,
          'tents_visited', bd.tents_visited,
          'spent', bd.spent
        )
      ELSE NULL
    END,
    'max_single_session', ms.max_beers,
    'most_expensive_day', CASE
      WHEN me.date IS NOT NULL THEN
        jsonb_build_object(
          'date', me.date,
          'amount', me.amount
        )
      ELSE NULL
    END
  ) INTO v_peak_moments
  FROM best_day bd, max_session ms, most_expensive me;

  v_result := v_result || jsonb_build_object('peak_moments', v_peak_moments);

  -- Calculate social stats (rankings use consumptions via helper)
  WITH user_groups AS (
    SELECT
      COUNT(DISTINCT gm.group_id) AS groups_joined,
      COUNT(DISTINCT gm2.user_id) AS total_group_members
    FROM group_members gm
    JOIN groups g ON gm.group_id = g.id
    LEFT JOIN group_members gm2 ON g.id = gm2.group_id AND gm2.user_id != p_user_id
    WHERE gm.user_id = p_user_id AND g.festival_id = p_festival_id
  ),
  top_rankings AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'group_name', group_name,
        'position', user_rank
      ) ORDER BY user_rank ASC
    ) AS rankings
    FROM (
      SELECT
        g.name AS group_name,
        wc.name AS winning_criteria,
        CASE
          WHEN wc.name = 'days_attended' THEN
            ROW_NUMBER() OVER (
              PARTITION BY g.id
              ORDER BY COUNT(DISTINCT a.date) DESC, p.username ASC
            )
          WHEN wc.name = 'total_beers' THEN
            ROW_NUMBER() OVER (
              PARTITION BY g.id
              ORDER BY COALESCE(SUM(_get_effective_drink_count(a.id)), 0) DESC, p.username ASC
            )
          WHEN wc.name = 'avg_beers' THEN
            ROW_NUMBER() OVER (
              PARTITION BY g.id
              ORDER BY COALESCE(AVG(_get_effective_drink_count(a.id)), 0) DESC, p.username ASC
            )
          ELSE 1
        END AS user_rank
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN attendances a ON gm.user_id = a.user_id AND a.festival_id = p_festival_id
      LEFT JOIN profiles p ON gm.user_id = p.id
      LEFT JOIN winning_criteria wc ON g.winning_criteria_id = wc.id
      WHERE g.festival_id = p_festival_id AND gm.user_id = p_user_id
      GROUP BY g.id, g.name, wc.name, p.username
    ) ranked
    WHERE user_rank <= 3
  ),
  photo_count AS (
    SELECT COUNT(*) AS photos_uploaded
    FROM beer_pictures bp
    JOIN attendances a ON bp.attendance_id = a.id
    WHERE bp.user_id = p_user_id
      AND a.date >= v_festival.start_date
      AND a.date <= v_festival.end_date
      AND a.festival_id = p_festival_id
  ),
  user_pictures AS (
    SELECT
      bp.id,
      bp.picture_url,
      bp.created_at,
      a.date as attendance_date
    FROM beer_pictures bp
    JOIN attendances a ON bp.attendance_id = a.id
    WHERE bp.user_id = p_user_id
      AND a.date >= v_festival.start_date
      AND a.date <= v_festival.end_date
      AND a.festival_id = p_festival_id
    ORDER BY bp.created_at DESC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'groups_joined', ug.groups_joined,
    'top_3_rankings', COALESCE(tr.rankings, '[]'::JSONB),
    'photos_uploaded', pc.photos_uploaded,
    'total_group_members', ug.total_group_members,
    'pictures', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', up.id,
          'picture_url', up.picture_url,
          'created_at', up.created_at,
          'attendance_date', up.attendance_date
        )
      ) FROM user_pictures up),
      '[]'::JSONB
    )
  ) INTO v_social_stats
  FROM user_groups ug, top_rankings tr, photo_count pc;

  v_result := v_result || jsonb_build_object('social_stats', v_social_stats);

  -- Calculate global leaderboard positions for days_attended, total_beers, and avg_beers
  -- Note: get_global_leaderboard uses its own logic; wrapped-specific positions calculated here
  WITH global_positions AS (
    SELECT
      'days_attended' as criteria,
      CASE
        WHEN array_length(array_agg(gl.user_id ORDER BY gl.days_attended DESC, gl.username ASC), 1) > 0
        THEN array_position(array_agg(gl.user_id ORDER BY gl.days_attended DESC, gl.username ASC), p_user_id)
        ELSE NULL
      END as position
    FROM get_global_leaderboard(1, p_festival_id) gl
    UNION ALL
    SELECT
      'total_beers' as criteria,
      CASE
        WHEN array_length(array_agg(gl.user_id ORDER BY gl.total_beers DESC, gl.username ASC), 1) > 0
        THEN array_position(array_agg(gl.user_id ORDER BY gl.total_beers DESC, gl.username ASC), p_user_id)
        ELSE NULL
      END as position
    FROM get_global_leaderboard(2, p_festival_id) gl
    UNION ALL
    SELECT
      'avg_beers' as criteria,
      CASE
        WHEN array_length(array_agg(gl.user_id ORDER BY gl.avg_beers DESC, gl.username ASC), 1) > 0
        THEN array_position(array_agg(gl.user_id ORDER BY gl.avg_beers DESC, gl.username ASC), p_user_id)
        ELSE NULL
      END as position
    FROM get_global_leaderboard(3, p_festival_id) gl
  )
  SELECT jsonb_build_object(
    'days_attended', MAX(CASE WHEN criteria = 'days_attended' THEN position END),
    'total_beers', MAX(CASE WHEN criteria = 'total_beers' THEN position END),
    'avg_beers', MAX(CASE WHEN criteria = 'avg_beers' THEN position END)
  ) INTO v_global_positions
  FROM global_positions;

  v_result := v_result || jsonb_build_object('global_leaderboard_positions', v_global_positions);

  -- Get achievements
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'description', a.description,
        'icon', a.icon,
        'category', a.category,
        'tier', COALESCE(a.tier, 1),
        'points', a.points,
        'rarity', a.rarity,
        'unlocked_at', ua.unlocked_at
      ) ORDER BY ua.unlocked_at DESC
    ),
    '[]'::JSONB
  ) INTO v_achievements
  FROM user_achievements ua
  JOIN achievements a ON ua.achievement_id = a.id
  WHERE ua.user_id = p_user_id AND ua.festival_id = p_festival_id;

  v_result := v_result || jsonb_build_object('achievements', v_achievements);

  -- Build timeline (daily progression) using consumptions
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'date', a.date,
        'beer_count', _get_effective_drink_count(a.id),
        'spent', ROUND(_get_effective_drink_count(a.id) * v_beer_cost, 2),
        'tents_visited', (
          SELECT COUNT(DISTINCT tent_id)
          FROM tent_visits tv
          WHERE tv.user_id = p_user_id
            AND tv.festival_id = p_festival_id
            AND (tv.visit_date AT TIME ZONE v_festival.timezone)::date = a.date
        )
      ) ORDER BY a.date ASC
    ),
    '[]'::JSONB
  ) INTO v_timeline
  FROM attendances a
  WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id;

  v_result := v_result || jsonb_build_object('timeline', v_timeline);

  -- Calculate comparisons using consumptions.
  -- Set-based rather than per-row _get_effective_drink_count: that helper re-reads the
  -- attendances row by id even though we already have it here, which cost ~600 extra
  -- buffer hits per festival. COUNT(*) rather than COUNT(DISTINCT a.date) is safe
  -- because of the unique_user_date_festival index on (user_id, date, festival_id).
  WITH festival_user_stats AS (
    SELECT
      a.user_id,
      COUNT(*) AS days_attended,
      COALESCE(SUM(COALESCE(NULLIF(c.drink_count, 0), a.beer_count)), 0) AS total_drinks
    FROM attendances a
    LEFT JOIN (
      SELECT cc.attendance_id, COUNT(*)::int AS drink_count
      FROM consumptions cc
      JOIN attendances aa ON aa.id = cc.attendance_id
      WHERE aa.festival_id = p_festival_id
      GROUP BY cc.attendance_id
    ) c ON c.attendance_id = a.id
    WHERE a.festival_id = p_festival_id
    GROUP BY a.user_id
  ),
  festival_avg AS (
    SELECT
      ROUND(AVG(total_drinks), 2) AS avg_beers,
      ROUND(AVG(days_attended), 2) AS avg_days,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_drinks)::NUMERIC, 2) AS median_beers,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_attended)::NUMERIC, 2) AS median_days
    FROM festival_user_stats
  ),
  -- Percentile rank: share of attendees strictly below the user. More meaningful than
  -- the mean diff, which is skewed by one-day attendees and by the top of the range.
  user_percentile AS (
    SELECT
      COUNT(*) AS total_users,
      COUNT(*) FILTER (
        WHERE fus.total_drinks < (v_basic_stats->>'total_beers')::NUMERIC
      ) AS below_beers,
      COUNT(*) FILTER (
        WHERE fus.days_attended < (v_basic_stats->>'days_attended')::NUMERIC
      ) AS below_days
    FROM festival_user_stats fus
  ),
  user_current AS (
    SELECT
      (v_basic_stats->>'total_beers')::NUMERIC AS user_beers,
      (v_basic_stats->>'days_attended')::NUMERIC AS user_days
  ),
  previous_festival AS (
    SELECT
      f.id as festival_id,
      f.name as festival_name,
      COUNT(DISTINCT a.date) AS prev_days,
      COALESCE(SUM(_get_effective_drink_count(a.id)), 0) AS prev_beers,
      COALESCE(SUM(_get_effective_drink_count(a.id)) * v_beer_cost, 0) AS prev_spent
    FROM attendances a
    JOIN festivals f ON a.festival_id = f.id
    WHERE a.user_id = p_user_id
      AND f.festival_type = v_festival.festival_type
      AND f.start_date < v_festival.start_date
      AND f.id != p_festival_id
    GROUP BY f.id, f.name, f.start_date
    ORDER BY f.start_date DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'vs_festival_avg', jsonb_build_object(
      'beers_diff_pct', CASE
        WHEN fa.avg_beers > 0 THEN ROUND(((uc.user_beers - fa.avg_beers) / fa.avg_beers) * 100, 1)
        ELSE 0
      END,
      'days_diff_pct', CASE
        WHEN fa.avg_days > 0 THEN ROUND(((uc.user_days - fa.avg_days) / fa.avg_days) * 100, 1)
        ELSE 0
      END,
      'avg_beers', fa.avg_beers,
      'avg_days', fa.avg_days,
      'median_beers', fa.median_beers,
      'median_days', fa.median_days,
      'beers_percentile', CASE
        WHEN up.total_users > 0 THEN ROUND((up.below_beers::NUMERIC / up.total_users) * 100, 1)
        ELSE 0
      END,
      'days_percentile', CASE
        WHEN up.total_users > 0 THEN ROUND((up.below_days::NUMERIC / up.total_users) * 100, 1)
        ELSE 0
      END
    ),
    'vs_last_year', CASE
      WHEN pf.prev_beers > 0 THEN
        jsonb_build_object(
          'beers_diff', uc.user_beers - pf.prev_beers,
          'days_diff', uc.user_days - pf.prev_days,
          'spent_diff', ROUND((uc.user_beers * v_beer_cost) - pf.prev_spent, 2),
          'prev_beers', pf.prev_beers,
          'prev_days', pf.prev_days,
          'prev_festival_name', pf.festival_name
        )
      ELSE NULL
    END
  ) INTO v_comparisons
  -- festival_avg / user_percentile / user_current are unGROUPed aggregates or constant
  -- selects, so they always yield exactly one row. previous_festival yields zero rows for
  -- a first-time attendee, which under the old CROSS JOIN collapsed the whole comparisons
  -- object to NULL and hid the festival average too.
  FROM festival_avg fa
  CROSS JOIN user_percentile up
  CROSS JOIN user_current uc
  LEFT JOIN previous_festival pf ON TRUE;

  v_result := v_result || jsonb_build_object('comparisons', v_comparisons);

  -- Calculate personality type using consumptions
  WITH attendance_drinks AS (
    SELECT
      a.id,
      a.date,
      _get_effective_drink_count(a.id) AS drink_count
    FROM attendances a
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
  ),
  user_patterns AS (
    SELECT
      (v_basic_stats->>'total_beers')::INT AS total_beers,
      (v_basic_stats->>'days_attended')::INT AS days_attended,
      (v_basic_stats->>'avg_beers')::NUMERIC AS avg_beers,
      (v_tent_stats->>'unique_tents')::INT AS unique_tents,
      (SELECT COUNT(*) FROM tents) AS total_tents,
      EXISTS (
        SELECT 1 FROM attendances
        WHERE user_id = p_user_id
          AND festival_id = p_festival_id
          AND date = v_festival.start_date
      ) AS attended_first_day,
      COALESCE(STDDEV(ad.drink_count), 0) AS beer_variance
    FROM attendance_drinks ad
  )
  SELECT jsonb_build_object(
    'type', CASE
      WHEN up.unique_tents >= up.total_tents * 0.7 THEN 'Explorer'
      WHEN up.avg_beers >= 8 THEN 'Champion'
      WHEN up.days_attended >= (v_festival.end_date - v_festival.start_date + 1) * 0.8 THEN 'Loyalist'
      WHEN up.avg_beers <= 3 AND up.days_attended >= 5 THEN 'Social Butterfly'
      WHEN up.beer_variance < 2 THEN 'Consistent'
      ELSE 'Casual Enjoyer'
    END,
    'traits', jsonb_build_array(
      CASE WHEN up.attended_first_day THEN 'Early Bird' END,
      CASE WHEN up.beer_variance < 2 THEN 'Steady Pace' ELSE 'Variable' END,
      CASE WHEN up.unique_tents >= up.total_tents * 0.5 THEN 'Tent Explorer' ELSE 'Tent Loyalist' END,
      CASE WHEN up.avg_beers >= 6 THEN 'Heavy Hitter'
           WHEN up.avg_beers >= 4 THEN 'Moderate'
           ELSE 'Light Drinker' END
    ) - ARRAY[NULL]::TEXT[]
  ) INTO v_personality
  FROM user_patterns up;

  v_result := v_result || jsonb_build_object('personality', v_personality);

  -- Calculate drink stats from consumptions table (type breakdown)
  WITH drink_breakdown AS (
    SELECT
      c.drink_type::text AS drink_type,
      COUNT(*) AS count
    FROM consumptions c
    JOIN attendances a ON c.attendance_id = a.id
    WHERE a.user_id = p_user_id
      AND a.festival_id = p_festival_id
    GROUP BY c.drink_type
  ),
  totals AS (
    SELECT SUM(count) AS total FROM drink_breakdown
  )
  SELECT jsonb_build_object(
    'total_drinks', COALESCE((SELECT total FROM totals), 0),
    'top_drink_type', (SELECT drink_type FROM drink_breakdown ORDER BY count DESC LIMIT 1),
    'breakdown', COALESCE(
      (SELECT jsonb_agg(
         jsonb_build_object(
           'drink_type', db.drink_type,
           'count', db.count,
           'percentage', CASE WHEN t.total > 0
             THEN ROUND((db.count::numeric / t.total::numeric) * 100, 1)
             ELSE 0 END
         ) ORDER BY db.count DESC
       ) FROM drink_breakdown db, totals t),
      '[]'::jsonb
    )
  ) INTO v_drink_stats;

  v_result := v_result || jsonb_build_object('drink_stats', v_drink_stats);

  RETURN v_result;
END;
$$;
