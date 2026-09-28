-- Wrapped foundation.
--
-- 1. Unlock: Wrapped used to unlock on festivals.status = 'ended', which
--    nothing ever sets (Oktoberfest 2026 was still 'upcoming' mid-festival). It
--    now unlocks at 00:00 in the festival's timezone on the day after end_date,
--    and the rule lives here so no client can compute or cache a Wrapped early.
-- 2. Cache version: the cache had no TTL and no version, so changing
--    get_wrapped_data left old shapes cached forever. data_version is compared
--    with wrapped_data_version(); any migration that changes get_wrapped_data
--    output must bump that constant.
-- 3. Tent totals counted every row in tents, not this festival's list, so
--    tent_diversity_pct, the Explorer personality (>= 70%) and the Tent Explorer
--    trait (>= 50%) were all too low. Both sites now count festival_tents.
-- 4. Wrapped matched "last year" by festival_type while Home progress matched
--    by series name. Both now call _previous_festival_in_series.
-- 5. Invalidation: drinks live in consumptions, which never invalidated the
--    cache, and profile name/avatar and group membership are in Wrapped too.
--    Consumption and attendance changes drop the whole festival's rows, since
--    every attendee's Wrapped carries festival-wide numbers (vs_festival_avg,
--    global positions, group rankings). Nothing is cached before the unlock,
--    so those deletes are no-ops during the festival itself.
-- 6. Regenerate used to UPDATE existing rows only, so it never seeded anyone.
-- 7. wrapped_viewed read wrapped_data_cache.first_viewed_at, which any
--    invalidation deletes. It now reads wrapped_views, the durable record.
-- 8. get_wrapped_data was executable by authenticated, which let a signed-in
--    user compute a Wrapped before unlock and skip the gate in
--    get_wrapped_data_cached.

CREATE OR REPLACE FUNCTION public.wrapped_unlocks_at(p_festival_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT ((f.end_date + 1)::timestamp AT TIME ZONE COALESCE(f.timezone, 'Europe/Berlin'))
  FROM festivals f
  WHERE f.id = p_festival_id;
$$;

COMMENT ON FUNCTION public.wrapped_unlocks_at(uuid) IS
  'Instant a festival''s Wrapped unlocks: 00:00 local (festivals.timezone) on end_date + 1.';

-- Bump this in the same migration as any change to get_wrapped_data output.
CREATE OR REPLACE FUNCTION public.wrapped_data_version()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 1 $$;

COMMENT ON FUNCTION public.wrapped_data_version() IS
  'Current shape version of get_wrapped_data. Cached rows with another version are recomputed. Bump on every get_wrapped_data output change.';

ALTER TABLE public.wrapped_data_cache
  ADD COLUMN IF NOT EXISTS data_version integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.get_wrapped_status(p_festival_id uuid)
RETURNS TABLE(unlocks_at timestamptz, is_unlocked boolean, has_attendance boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_unlocks_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  v_unlocks_at := wrapped_unlocks_at(p_festival_id);
  IF v_unlocks_at IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_unlocks_at,
    (now() >= v_unlocks_at OR public.is_super_admin()),
    EXISTS (
      SELECT 1 FROM attendances a
      WHERE a.user_id = v_user_id AND a.festival_id = p_festival_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_wrapped_festivals()
RETURNS TABLE(
  festival_id uuid,
  name text,
  start_date date,
  end_date date,
  unlocks_at timestamptz,
  viewed boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    f.id,
    f.name::text,
    f.start_date,
    f.end_date,
    wrapped_unlocks_at(f.id),
    EXISTS (
      SELECT 1 FROM wrapped_views v
      WHERE v.user_id = auth.uid() AND v.festival_id = f.id
    )
  FROM festivals f
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM attendances a
      WHERE a.user_id = auth.uid() AND a.festival_id = f.id
    )
    AND now() >= wrapped_unlocks_at(f.id)
  ORDER BY f.start_date DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_wrapped_data_cached(p_user_id uuid, p_festival_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cached_data jsonb;
  v_calculated_data jsonb;
  v_is_unlocked boolean;
BEGIN
  IF auth.uid() IS NOT NULL
     AND p_user_id <> auth.uid()
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized to read wrapped data for another user'
      USING ERRCODE = '42501';
  END IF;

  v_is_unlocked := now() >= COALESCE(wrapped_unlocks_at(p_festival_id), 'infinity'::timestamptz);

  IF NOT v_is_unlocked AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'WRAPPED_NOT_READY' USING ERRCODE = 'P0001';
  END IF;

  -- Super admin preview of a locked festival: compute, never cache, so no
  -- pre-unlock row can outlive the festival's last day.
  IF NOT v_is_unlocked THEN
    RETURN get_wrapped_data(p_user_id, p_festival_id);
  END IF;

  SELECT wrapped_data INTO v_cached_data
  FROM wrapped_data_cache
  WHERE user_id = p_user_id
    AND festival_id = p_festival_id
    AND data_version = wrapped_data_version();

  IF v_cached_data IS NOT NULL THEN
    RETURN v_cached_data;
  END IF;

  v_calculated_data := get_wrapped_data(p_user_id, p_festival_id);

  IF v_calculated_data IS NOT NULL THEN
    INSERT INTO wrapped_data_cache (user_id, festival_id, wrapped_data, generated_by, data_version)
    VALUES (p_user_id, p_festival_id, v_calculated_data, 'system', wrapped_data_version())
    ON CONFLICT (user_id, festival_id)
    DO UPDATE SET
      wrapped_data = EXCLUDED.wrapped_data,
      generated_by = EXCLUDED.generated_by,
      data_version = EXCLUDED.data_version,
      updated_at = NOW();
  END IF;

  RETURN v_calculated_data;
END;
$$;

COMMENT ON FUNCTION public.get_wrapped_data_cached(uuid, uuid) IS
  'Cached Wrapped for a user and festival. Raises WRAPPED_NOT_READY before wrapped_unlocks_at unless super admin (computed, not cached). Rows with a stale data_version are recomputed.';

-- Supabase default privileges grant new functions to anon and authenticated
-- directly, so PUBLIC alone is not enough: revoke by name.
REVOKE EXECUTE ON FUNCTION public.wrapped_unlocks_at(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wrapped_unlocks_at(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.wrapped_data_version() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wrapped_data_version() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_wrapped_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wrapped_status(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_wrapped_festivals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wrapped_festivals() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_wrapped_data_cached(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wrapped_data_cached(uuid, uuid) TO authenticated, service_role;

-- get_wrapped_data: rest unchanged from 20260924144242_group_criteria_tents_streak.

CREATE OR REPLACE FUNCTION public._previous_festival_in_series(p_user_id uuid, p_festival_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  -- Same series rule as getFestivalSeriesKey: name without the trailing year.
  SELECT f.id
  FROM festivals f
  JOIN festivals cur ON cur.id = p_festival_id
  WHERE f.id <> cur.id
    AND f.start_date < cur.start_date
    AND lower(btrim(regexp_replace(f.name, '\s+\d{4}\s*$', '')))
      = lower(btrim(regexp_replace(cur.name, '\s+\d{4}\s*$', '')))
    AND EXISTS (
      SELECT 1 FROM attendances a WHERE a.user_id = p_user_id AND a.festival_id = f.id
    )
  ORDER BY f.start_date DESC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public._previous_festival_in_series(uuid, uuid) FROM PUBLIC, anon;
-- get_user_festival_progress is SECURITY INVOKER, so authenticated needs EXECUTE.
GRANT EXECUTE ON FUNCTION public._previous_festival_in_series(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_wrapped_data(p_user_id uuid, p_festival_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      _get_effective_drink_count(a.id) AS drink_count,
      _get_effective_spend_cents(a.id) AS spend_cents
    FROM attendances a
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
  ),
  attendance_agg AS (
    SELECT
      COUNT(DISTINCT ad.date) AS days_attended,
      COALESCE(SUM(ad.drink_count), 0) AS total_beers,
      COALESCE(SUM(ad.spend_cents), 0) AS total_spend_cents,
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
    'total_spent', ROUND(total_spend_cents / 100.0, 2),
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
    SELECT COUNT(*) AS total_tents FROM festival_tents WHERE festival_id = p_festival_id
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
      _get_effective_spend_cents(a.id) AS spend_cents,
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
      ROUND(db.spend_cents / 100.0, 2) AS spent
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
      SELECT g.name AS group_name, member_rank.position AS user_rank
      FROM groups g
      JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = p_user_id
      CROSS JOIN LATERAL (
        SELECT lb.position
        FROM get_group_leaderboard(g.id, g.winning_criteria_id) WITH ORDINALITY AS lb(
          lb_user_id, lb_username, lb_full_name, lb_avatar_url, lb_group_id, lb_group_name,
          lb_festival_id, lb_festival_name, lb_days_attended, lb_total_beers, lb_avg_beers,
          lb_tents_visited, lb_longest_streak, position
        )
        WHERE lb.lb_user_id = p_user_id
      ) member_rank
      WHERE g.festival_id = p_festival_id
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
        'rarity', tier_to_rarity(a.tier),
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
        'spent', ROUND(_get_effective_spend_cents(a.id) / 100.0, 2),
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
      (v_basic_stats->>'days_attended')::NUMERIC AS user_days,
      (v_basic_stats->>'total_spent')::NUMERIC AS user_spent
  ),
  previous_festival AS (
    SELECT
      f.id AS festival_id,
      f.name AS festival_name,
      COUNT(DISTINCT a.date) AS prev_days,
      COALESCE(SUM(_get_effective_drink_count(a.id)), 0) AS prev_beers,
      ROUND(COALESCE(SUM(_get_effective_spend_cents(a.id)), 0) / 100.0, 2) AS prev_spent
    FROM festivals f
    JOIN attendances a ON a.festival_id = f.id AND a.user_id = p_user_id
    WHERE f.id = _previous_festival_in_series(p_user_id, p_festival_id)
    GROUP BY f.id, f.name
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
          'spent_diff', ROUND(uc.user_spent - pf.prev_spent, 2),
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
      (SELECT COUNT(*) FROM festival_tents WHERE festival_id = p_festival_id) AS total_tents,
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
      WHEN up.total_tents > 0 AND up.unique_tents >= up.total_tents * 0.7 THEN 'Explorer'
      WHEN up.avg_beers >= 8 THEN 'Champion'
      WHEN up.days_attended >= (v_festival.end_date - v_festival.start_date + 1) * 0.8 THEN 'Loyalist'
      WHEN up.avg_beers <= 3 AND up.days_attended >= 5 THEN 'Social Butterfly'
      WHEN up.beer_variance < 2 THEN 'Consistent'
      ELSE 'Casual Enjoyer'
    END,
    'traits', jsonb_build_array(
      CASE WHEN up.attended_first_day THEN 'Early Bird' END,
      CASE WHEN up.beer_variance < 2 THEN 'Steady Pace' ELSE 'Variable' END,
      CASE WHEN up.total_tents > 0 AND up.unique_tents >= up.total_tents * 0.5 THEN 'Tent Explorer' ELSE 'Tent Loyalist' END,
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
$function$;

-- get_user_festival_progress: body identical to 20260925104728 except the
-- previous CTE, which now calls the shared helper.
CREATE OR REPLACE FUNCTION public.get_user_festival_progress(
  p_festival_id uuid,
  p_today date DEFAULT NULL
)
RETURNS TABLE(
  current_streak integer,
  best_streak integer,
  tents_visited integer,
  tents_total integer,
  previous_festival_name text,
  previous_festival_beers numeric,
  previous_festival_days integer,
  groups_this_festival integer,
  accepted_friends integer,
  photos_uploaded integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_festival festivals%ROWTYPE;
  v_today date;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_festival FROM festivals WHERE id = p_festival_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_today := COALESCE(p_today, (now() AT TIME ZONE v_festival.timezone)::date);

  RETURN QUERY
  WITH attended AS (
    SELECT DISTINCT a.date AS attended_on
    FROM attendances a
    WHERE a.user_id = v_user_id
      AND a.festival_id = p_festival_id
      AND a.date <= v_today
  ),
  runs AS (
    SELECT MAX(numbered.attended_on) AS run_end, COUNT(*)::integer AS run_length
    FROM (
      SELECT attended_on, attended_on - (ROW_NUMBER() OVER (ORDER BY attended_on))::integer AS run_key
      FROM attended
    ) numbered
    GROUP BY numbered.run_key
  ),
  previous AS (
    SELECT f.id, f.name
    FROM festivals f
    WHERE f.id = _previous_festival_in_series(v_user_id, p_festival_id)
  )
  SELECT
    -- Yesterday still counts, so the streak does not read 0 before today is logged
    COALESCE((SELECT r.run_length FROM runs r WHERE r.run_end >= v_today - 1 ORDER BY r.run_end DESC LIMIT 1), 0),
    COALESCE((SELECT MAX(r.run_length) FROM runs r), 0),
    -- Only tents on this festival's list, so visited never exceeds the total
    (SELECT COUNT(DISTINCT tv.tent_id)::integer
       FROM tent_visits tv
       JOIN festival_tents ft ON ft.festival_id = tv.festival_id AND ft.tent_id = tv.tent_id
      WHERE tv.user_id = v_user_id AND tv.festival_id = p_festival_id),
    (SELECT COUNT(*)::integer FROM festival_tents ft WHERE ft.festival_id = p_festival_id),
    (SELECT p.name::text FROM previous p),
    -- Drinks live in consumptions; attendances.beer_count stopped being written
    -- in 20260317130000_stop_writing_beer_count. A Radler is half a beer, like
    -- the leaderboards (20260325120000_radler_half_beer_leaderboard).
    (SELECT COALESCE(SUM(CASE WHEN c.drink_type = 'radler' THEN 0.5 ELSE 1.0 END), 0)::numeric
       FROM attendances a
       JOIN previous p ON p.id = a.festival_id
       JOIN consumptions c ON c.attendance_id = a.id AND c.drink_type IN ('beer', 'radler')
      WHERE a.user_id = v_user_id),
    (SELECT COUNT(DISTINCT a.date)::integer
       FROM attendances a JOIN previous p ON p.id = a.festival_id
      WHERE a.user_id = v_user_id),
    (SELECT COUNT(*)::integer
       FROM group_members gm JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_id = v_user_id AND g.festival_id = p_festival_id),
    (SELECT COUNT(*)::integer
       FROM friendships fr
      WHERE fr.status = 'accepted'
        AND (fr.requester_id = v_user_id OR fr.addressee_id = v_user_id)),
    (SELECT COUNT(bp.id)::integer
       FROM beer_pictures bp JOIN attendances a ON a.id = bp.attendance_id
      WHERE bp.user_id = v_user_id AND a.festival_id = p_festival_id);
END;
$$;

-- Supabase default privileges grant new functions to anon directly, so PUBLIC alone is not enough
REVOKE EXECUTE ON FUNCTION public.get_user_festival_progress(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_festival_progress(uuid, date) TO authenticated;

-- Trigger functions are SECURITY DEFINER so the DELETE passes RLS (same shape
-- as the beer_pictures trigger, 20260924172539).

CREATE OR REPLACE FUNCTION public.trigger_consumption_cache_invalidation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- OLD is NULL on INSERT and NEW is NULL on DELETE; an UPDATE that moves a
  -- drink to another attendance invalidates both festivals.
  DELETE FROM wrapped_data_cache
  WHERE festival_id IN (
    SELECT a.festival_id
    FROM attendances a
    WHERE a.id IN (OLD.attendance_id, NEW.attendance_id)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_wrapped_cache_invalidation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Attendance days feed the days_attended leaderboard, so every attendee's
  -- position can move. Both festivals when an UPDATE moves the row.
  DELETE FROM wrapped_data_cache
  WHERE festival_id IN (OLD.festival_id, NEW.festival_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_profile_wrapped_cache_invalidation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM invalidate_wrapped_cache(NEW.id, NULL);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_group_member_wrapped_cache_invalidation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_festival_id uuid;
BEGIN
  -- When the whole group is deleted the row is already gone and the lookup
  -- finds nothing; that path is not worth a Wrapped refresh.
  SELECT g.festival_id INTO v_festival_id
  FROM groups g
  WHERE g.id = COALESCE(NEW.group_id, OLD.group_id);

  IF v_festival_id IS NOT NULL THEN
    PERFORM invalidate_wrapped_cache(COALESCE(NEW.user_id, OLD.user_id), v_festival_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Only ever run as triggers.
REVOKE EXECUTE ON FUNCTION public.trigger_consumption_cache_invalidation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_wrapped_cache_invalidation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_profile_wrapped_cache_invalidation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_group_member_wrapped_cache_invalidation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_consumptions_wrapped_cache_invalidation ON public.consumptions;
CREATE TRIGGER tr_consumptions_wrapped_cache_invalidation
AFTER INSERT OR UPDATE OR DELETE ON public.consumptions
FOR EACH ROW EXECUTE FUNCTION public.trigger_consumption_cache_invalidation();

DROP TRIGGER IF EXISTS tr_profiles_wrapped_cache_invalidation ON public.profiles;
CREATE TRIGGER tr_profiles_wrapped_cache_invalidation
AFTER UPDATE OF username, full_name, avatar_url ON public.profiles
FOR EACH ROW
WHEN (
  OLD.username IS DISTINCT FROM NEW.username
  OR OLD.full_name IS DISTINCT FROM NEW.full_name
  OR OLD.avatar_url IS DISTINCT FROM NEW.avatar_url
)
EXECUTE FUNCTION public.trigger_profile_wrapped_cache_invalidation();

DROP TRIGGER IF EXISTS tr_group_members_wrapped_cache_invalidation ON public.group_members;
CREATE TRIGGER tr_group_members_wrapped_cache_invalidation
AFTER INSERT OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.trigger_group_member_wrapped_cache_invalidation();

-- Regenerate used to UPDATE existing rows only, so "regenerate all" skipped
-- everyone who had never opened Wrapped. It now upserts every attendee of every
-- unlocked festival matching the filters. p_admin_user_id is kept for the
-- existing client signature and is ignored; authorization comes from the JWT.
CREATE OR REPLACE FUNCTION public.regenerate_wrapped_data_cache(
  p_user_id uuid DEFAULT NULL::uuid,
  p_festival_id uuid DEFAULT NULL::uuid,
  p_admin_user_id uuid DEFAULT NULL::uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_regenerated_count integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Insufficient permissions to regenerate cache'
      USING ERRCODE = '42501';
  END IF;

  WITH targets AS (
    SELECT DISTINCT a.user_id, a.festival_id
    FROM attendances a
    WHERE (p_user_id IS NULL OR a.user_id = p_user_id)
      AND (p_festival_id IS NULL OR a.festival_id = p_festival_id)
      AND now() >= wrapped_unlocks_at(a.festival_id)
  ),
  calculated AS (
    SELECT t.user_id, t.festival_id, get_wrapped_data(t.user_id, t.festival_id) AS new_data
    FROM targets t
  )
  INSERT INTO wrapped_data_cache (user_id, festival_id, wrapped_data, generated_by, data_version)
  SELECT c.user_id, c.festival_id, c.new_data, 'admin', wrapped_data_version()
  FROM calculated c
  WHERE c.new_data IS NOT NULL
  ON CONFLICT (user_id, festival_id)
  DO UPDATE SET
    wrapped_data = EXCLUDED.wrapped_data,
    generated_by = 'admin',
    data_version = EXCLUDED.data_version,
    updated_at = NOW();

  GET DIAGNOSTICS v_regenerated_count = ROW_COUNT;

  RETURN v_regenerated_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.regenerate_wrapped_data_cache(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_wrapped_data_cache(uuid, uuid, uuid) TO authenticated, service_role;

-- get_achievement_metrics body copied from the live definition
-- (20260805120828_achievement_metrics_function); only wrapped_viewed changes.
CREATE OR REPLACE FUNCTION public.get_achievement_metrics(p_user_id uuid, p_festival_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NOT NULL
     AND p_user_id <> auth.uid()
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized to read achievement metrics for another user'
      USING ERRCODE = '42501';
  END IF;

  WITH fest AS (
    SELECT id, start_date, end_date FROM festivals WHERE id = p_festival_id
  ),
  user_att AS (
    SELECT a.id, a.date
    FROM attendances a
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
  ),
  cons AS (
    SELECT c.drink_type, c.volume_ml, c.price_paid_cents, c.tip_cents, ua.date
    FROM user_att ua
    JOIN consumptions c ON c.attendance_id = ua.id
  ),
  per_day AS (
    SELECT date, count(*) AS drinks FROM cons GROUP BY date
  ),
  -- Gaps-and-islands: consecutive dates share (date - row_number).
  att_streak AS (
    SELECT coalesce(max(run_len), 0) AS max_streak
    FROM (
      SELECT count(*) AS run_len
      FROM (
        SELECT date - (row_number() OVER (ORDER BY date))::int AS island
        FROM (SELECT DISTINCT date FROM user_att) distinct_days
      ) islands
      GROUP BY island
    ) runs
  ),
  active_streak AS (
    SELECT coalesce(max(run_len), 0) AS max_streak
    FROM (
      SELECT count(*) AS run_len
      FROM (
        SELECT day - (row_number() OVER (ORDER BY day))::int AS island
        FROM (SELECT DISTINCT day FROM user_active_days WHERE user_id = p_user_id) d
      ) islands
      GROUP BY island
    ) runs
  ),
  festival_weekend_days AS (
    SELECT count(*) AS total
    FROM fest, generate_series(fest.start_date, fest.end_date, '1 day'::interval) AS d
    WHERE extract(dow FROM d) IN (0, 6)
  ),
  attended_weekend_days AS (
    SELECT count(DISTINCT ua.date) AS total
    FROM user_att ua
    WHERE extract(dow FROM ua.date) IN (0, 6)
  ),
  large_tents AS (
    SELECT count(DISTINCT ft.tent_id) AS total
    FROM festival_tents ft
    JOIN tents t ON t.id = ft.tent_id
    WHERE ft.festival_id = p_festival_id AND t.category = 'large'
  ),
  visited_large_tents AS (
    SELECT count(DISTINCT tv.tent_id) AS total
    FROM tent_visits tv
    JOIN tents t ON t.id = tv.tent_id
    WHERE tv.user_id = p_user_id
      AND tv.festival_id = p_festival_id
      AND t.category = 'large'
  )
  SELECT jsonb_build_object(
    -- festival-scoped, numeric
    'drinks_total',          (SELECT count(*) FROM cons),
    'drinks_day_max',        (SELECT coalesce(max(drinks), 0) FROM per_day),
    'drink_types_distinct',  (SELECT count(DISTINCT drink_type) FROM cons),
    'volume_ml_total',       (SELECT coalesce(sum(volume_ml), 0) FROM cons),
    'tip_cents_total',       (SELECT coalesce(sum(tip_cents), 0) FROM cons),
    'spend_cents_total',     (SELECT coalesce(sum(price_paid_cents), 0) FROM cons),
    'days_attended',         (SELECT count(DISTINCT date) FROM user_att),
    'attendance_streak_max', (SELECT max_streak FROM att_streak),
    'tents_distinct',        (SELECT count(DISTINCT tv.tent_id) FROM tent_visits tv
                                WHERE tv.user_id = p_user_id AND tv.festival_id = p_festival_id),
    'groups_joined',         (SELECT count(DISTINCT gm.group_id)
                                FROM group_members gm
                                JOIN groups g ON g.id = gm.group_id
                                WHERE gm.user_id = p_user_id AND g.festival_id = p_festival_id),
    'photos_uploaded',       (SELECT count(*) FROM beer_pictures bp
                                JOIN user_att ua ON ua.id = bp.attendance_id
                                WHERE bp.user_id = p_user_id),
    'reactions_given',       (SELECT count(*) FROM photo_reactions pr
                                JOIN beer_pictures bp ON bp.id = pr.photo_id
                                JOIN attendances a ON a.id = bp.attendance_id
                                WHERE pr.user_id = p_user_id AND a.festival_id = p_festival_id),
    'crowd_reports',         (SELECT count(*) FROM tent_crowd_reports tcr
                                WHERE tcr.user_id = p_user_id AND tcr.festival_id = p_festival_id),

    -- lifetime, numeric
    'festivals_attended',      (SELECT count(DISTINCT a.festival_id) FROM attendances a
                                  WHERE a.user_id = p_user_id),
    'festival_types_distinct', (SELECT count(DISTINCT f.festival_type)
                                  FROM attendances a JOIN festivals f ON f.id = a.festival_id
                                  WHERE a.user_id = p_user_id),
    'friends_accepted',        (SELECT count(*) FROM friendships fr
                                  WHERE fr.status = 'accepted'
                                    AND (fr.requester_id = p_user_id OR fr.addressee_id = p_user_id)),
    'group_wins',              (SELECT count(*) FROM festival_group_standings s
                                  JOIN festivals f ON f.id = s.festival_id
                                  WHERE s.user_id = p_user_id AND s.rank = 1 AND s.member_count >= 2
                                    AND f.end_date < CURRENT_DATE),
    'podium_finishes',         (SELECT count(*) FROM festival_group_standings s
                                  JOIN festivals f ON f.id = s.festival_id
                                  WHERE s.user_id = p_user_id AND s.rank <= 3 AND s.member_count >= 2
                                    AND f.end_date < CURRENT_DATE),
    'active_days_total',       (SELECT count(*) FROM user_active_days uad
                                  WHERE uad.user_id = p_user_id),
    'active_day_streak_max',   (SELECT max_streak FROM active_streak),

    -- festival-scoped, boolean
    'attended_opening_day', (SELECT EXISTS (
                                SELECT 1 FROM user_att ua, fest
                                WHERE ua.date = fest.start_date)),
    'attended_closing_day', (SELECT EXISTS (
                                SELECT 1 FROM user_att ua, fest
                                WHERE ua.date = fest.end_date)),
    'attended_every_day',   (SELECT (SELECT count(DISTINCT date) FROM user_att)
                                    = (SELECT (end_date - start_date + 1) FROM fest)
                              AND (SELECT count(*) FROM user_att) > 0),
    'attended_every_weekend_day',
                            (SELECT (SELECT total FROM festival_weekend_days) > 0
                              AND (SELECT total FROM attended_weekend_days)
                                  = (SELECT total FROM festival_weekend_days)),
    'visited_all_large_tents',
                            (SELECT (SELECT total FROM large_tents) > 0
                              AND (SELECT total FROM visited_large_tents)
                                  = (SELECT total FROM large_tents)),
    'created_group',        (SELECT EXISTS (
                                SELECT 1 FROM groups g
                                WHERE g.created_by = p_user_id AND g.festival_id = p_festival_id)),

    -- lifetime, boolean
    'logged_first_drink',  (SELECT EXISTS (
                                SELECT 1 FROM consumptions c
                                JOIN attendances a ON a.id = c.attendance_id
                                WHERE a.user_id = p_user_id)),
    'uploaded_first_photo', (SELECT EXISTS (
                                SELECT 1 FROM beer_pictures bp WHERE bp.user_id = p_user_id)),
    'profile_complete',     (SELECT EXISTS (
                                SELECT 1 FROM profiles p
                                WHERE p.id = p_user_id
                                  AND p.username IS NOT NULL
                                  AND p.full_name IS NOT NULL
                                  AND p.avatar_url IS NOT NULL)),
    -- wrapped_views, not wrapped_data_cache.first_viewed_at: cache invalidation
    -- triggers (including the user_achievements one an unlock in the same pass
    -- fires) delete that row before this is read.
    'wrapped_viewed',       (SELECT EXISTS (
                                SELECT 1 FROM wrapped_views wv
                                WHERE wv.user_id = p_user_id))
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_wrapped_data(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_wrapped_data(uuid, uuid) TO service_role;
