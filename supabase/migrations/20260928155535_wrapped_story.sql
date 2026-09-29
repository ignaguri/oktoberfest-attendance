-- Wrapped story (sub-project 2).
--
-- 1. get_wrapped_data gains a timing block (first/last drink hour, peak hour,
--    weekend share, in the festival's timezone) and vs_festival_avg.attendee_count,
--    which the story uses to skip percentiles at tiny festivals, and
--    festival_info.festival_type, which keeps the Wiesn copy to Oktoberfest, and a
--    social_score per picture (reactions + comments + 2x tags) over the whole
--    festival, so the story can show the photos friends engaged with. Output changes,
--    so wrapped_data_version goes to 3 (the foundation's migrations left it at 2).
-- 2. festival_official_stats holds the city's final numbers (Wiesn-Bilanz),
--    read next to the cached Wrapped, never inside it. get_festival_official_stats
--    falls back to the latest earlier festival of the same series.
-- 3. Seed: Oktoberfest 2025 from the muenchen.de Wiesn-Bilanz 2025.
-- 4. Reactions, comments and tags now pick the story's photos, so a write to any of
--    them drops the photo owner's cached Wrapped, like a beer_pictures write does.

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
  v_timing JSONB;
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
      'location', v_festival.location,
      'festival_type', v_festival.festival_type
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
  -- Every festival photo (capped), not the newest few: the story picks from the
  -- whole festival. social_score weighs a tagged friend double a reaction or
  -- comment, since the slide is "Your people".
  user_pictures AS (
    SELECT
      bp.id,
      bp.picture_url,
      bp.created_at,
      a.date as attendance_date,
      (SELECT COUNT(*) FROM photo_reactions r WHERE r.photo_id = bp.id)
        + (SELECT COUNT(*) FROM photo_comments c WHERE c.photo_id = bp.id)
        + 2 * (SELECT COUNT(*) FROM photo_tags t WHERE t.photo_id = bp.id) AS social_score
    FROM beer_pictures bp
    JOIN attendances a ON bp.attendance_id = a.id
    WHERE bp.user_id = p_user_id
      AND a.date >= v_festival.start_date
      AND a.date <= v_festival.end_date
      AND a.festival_id = p_festival_id
    ORDER BY bp.created_at DESC
    LIMIT 100
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
          'attendance_date', up.attendance_date,
          'social_score', up.social_score
        )
        ORDER BY up.created_at DESC
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
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_attended)::NUMERIC, 2) AS median_days,
      COUNT(*) AS attendee_count
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
      END,
      'attendee_count', fa.attendee_count
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

  -- Drink timing, in the festival's timezone. A drink before 06:00 belongs to
  -- the previous evening, so its hour counts as 24 + h.
  WITH timed AS (
    SELECT
      a.date,
      c.recorded_at,
      EXTRACT(HOUR FROM (c.recorded_at AT TIME ZONE COALESCE(v_festival.timezone, 'Europe/Berlin')))
        + EXTRACT(MINUTE FROM (c.recorded_at AT TIME ZONE COALESCE(v_festival.timezone, 'Europe/Berlin'))) / 60.0
        AS local_hour
    FROM consumptions c
    JOIN attendances a ON a.id = c.attendance_id
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
  ),
  -- Backfilled drinks (older festivals were migrated from beer_count) share one
  -- made-up timestamp per day, so only days with at least two distinct times
  -- count as timed. A real one-drink day is dropped too, which is harmless.
  logged AS (
    SELECT date, recorded_at, local_hour
    FROM timed
    WHERE date IN (
      SELECT date FROM timed GROUP BY date HAVING COUNT(DISTINCT recorded_at) > 1
    )
  ),
  shifted AS (
    SELECT date, CASE WHEN local_hour < 6 THEN local_hour + 24 ELSE local_hour END AS hour
    FROM logged
  ),
  per_day AS (
    SELECT date, MIN(hour) AS first_hour, MAX(hour) AS last_hour
    FROM shifted
    GROUP BY date
  ),
  attended AS (
    SELECT DISTINCT a.date
    FROM attendances a
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
  )
  SELECT jsonb_build_object(
    'timed_days', (SELECT COUNT(*) FROM per_day),
    'median_first_hour', (
      SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY first_hour)::NUMERIC, 2) FROM per_day
    ),
    'median_last_hour', (
      SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY last_hour)::NUMERIC, 2) FROM per_day
    ),
    'peak_hour', (
      SELECT FLOOR(hour)::INT FROM shifted
      GROUP BY FLOOR(hour)
      ORDER BY COUNT(*) DESC, FLOOR(hour) ASC
      LIMIT 1
    ),
    'weekend_share', (
      SELECT CASE WHEN COUNT(*) = 0 THEN NULL
        ELSE ROUND(COUNT(*) FILTER (WHERE EXTRACT(ISODOW FROM date) IN (6, 7))::NUMERIC / COUNT(*), 2)
      END
      FROM attended
    )
  ) INTO v_timing;

  v_result := v_result || jsonb_build_object('timing', v_timing);

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_wrapped_data(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_wrapped_data(uuid, uuid) TO service_role;

-- Bump this in the same migration as any change to get_wrapped_data output.
CREATE OR REPLACE FUNCTION public.wrapped_data_version()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 3 $$;

CREATE TABLE IF NOT EXISTS public.festival_official_stats (
  festival_id uuid PRIMARY KEY REFERENCES public.festivals(id) ON DELETE CASCADE,
  visitors bigint CHECK (visitors >= 0),
  mass_served bigint CHECK (mass_served >= 0),
  mugs_confiscated integer CHECK (mugs_confiscated >= 0),
  lost_items integer CHECK (lost_items >= 0),
  curious_finds jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(curious_finds) = 'array' AND jsonb_array_length(curious_finds) <= 3),
  source_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.festival_official_stats IS
  'Official end-of-festival numbers (e.g. the Wiesn-Bilanz), entered by a super admin, shown in Wrapped.';

ALTER TABLE public.festival_official_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read official stats"
  ON public.festival_official_stats
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage official stats"
  ON public.festival_official_stats
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

REVOKE ALL ON TABLE public.festival_official_stats FROM anon;

CREATE OR REPLACE FUNCTION public.get_festival_official_stats(p_festival_id uuid)
RETURNS TABLE (
  source_festival_id uuid,
  stats_year integer,
  visitors bigint,
  mass_served bigint,
  mugs_confiscated integer,
  lost_items integer,
  curious_finds jsonb,
  source_url text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  -- Own row first, otherwise the latest earlier festival of the same series
  -- (the series rule of _previous_festival_in_series: name without the year).
  SELECT
    s.festival_id,
    EXTRACT(YEAR FROM f.start_date)::integer,
    s.visitors,
    s.mass_served,
    s.mugs_confiscated,
    s.lost_items,
    s.curious_finds,
    s.source_url
  FROM festival_official_stats s
  JOIN festivals f ON f.id = s.festival_id
  JOIN festivals cur ON cur.id = p_festival_id
  WHERE f.start_date <= cur.start_date
    AND lower(btrim(regexp_replace(f.name, '\s+\d{4}\s*$', '')))
      = lower(btrim(regexp_replace(cur.name, '\s+\d{4}\s*$', '')))
  ORDER BY f.start_date DESC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_festival_official_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_festival_official_stats(uuid) TO authenticated, service_role;

INSERT INTO public.festival_official_stats
  (festival_id, visitors, mass_served, mugs_confiscated, lost_items, curious_finds, source_url)
SELECT
  f.id,
  6500000,
  6500000,
  116000,
  4500,
  '[
    {"de": "ein Akkordeon", "en": "an accordion", "es": "un acordeón"},
    {"de": "eine Knirschschiene", "en": "a night guard", "es": "una placa de descanso"},
    {"de": "ein Geldbeutel mit 620 Euro", "en": "a wallet with €620", "es": "una billetera con 620 €"}
  ]'::jsonb,
  'https://www.muenchen.de/veranstaltungen/oktoberfest/aktuell/wiesn-bilanz-2025-zahlen-und-fakten'
FROM public.festivals f
WHERE f.name = 'Oktoberfest 2025'
ON CONFLICT (festival_id) DO NOTHING;

-- 4. Engagement on a photo changes its social_score, so it drops the owner's
-- cached Wrapped. The owner and festival come from the photo; when the photo
-- itself is deleted the lookup finds nothing, and the beer_pictures trigger
-- covers that case.
CREATE OR REPLACE FUNCTION public.trigger_photo_engagement_cache_invalidation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_festival_id uuid;
BEGIN
  SELECT bp.user_id, a.festival_id INTO v_user_id, v_festival_id
  FROM beer_pictures bp
  JOIN attendances a ON a.id = bp.attendance_id
  WHERE bp.id = COALESCE(NEW.photo_id, OLD.photo_id);

  IF v_user_id IS NOT NULL AND v_festival_id IS NOT NULL THEN
    PERFORM invalidate_wrapped_cache(v_user_id, v_festival_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Only ever runs as a trigger; EXECUTE is checked when the trigger is created,
-- not when it fires, so no role needs it.
REVOKE EXECUTE ON FUNCTION public.trigger_photo_engagement_cache_invalidation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_photo_reactions_wrapped_cache_invalidation ON public.photo_reactions;
CREATE TRIGGER tr_photo_reactions_wrapped_cache_invalidation
AFTER INSERT OR DELETE ON public.photo_reactions
FOR EACH ROW EXECUTE FUNCTION public.trigger_photo_engagement_cache_invalidation();

DROP TRIGGER IF EXISTS tr_photo_comments_wrapped_cache_invalidation ON public.photo_comments;
CREATE TRIGGER tr_photo_comments_wrapped_cache_invalidation
AFTER INSERT OR DELETE ON public.photo_comments
FOR EACH ROW EXECUTE FUNCTION public.trigger_photo_engagement_cache_invalidation();

DROP TRIGGER IF EXISTS tr_photo_tags_wrapped_cache_invalidation ON public.photo_tags;
CREATE TRIGGER tr_photo_tags_wrapped_cache_invalidation
AFTER INSERT OR DELETE ON public.photo_tags
FOR EACH ROW EXECUTE FUNCTION public.trigger_photo_engagement_cache_invalidation();
