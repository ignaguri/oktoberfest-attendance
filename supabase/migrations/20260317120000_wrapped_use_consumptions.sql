-- Migrate get_wrapped_data to use consumptions table instead of legacy beer_count.
-- Uses COALESCE(NULLIF(consumptions_count, 0), beer_count) for backwards compatibility
-- with attendances that don't yet have consumptions rows.

-- Helper function: get effective drink count for an attendance
-- Returns consumptions count if > 0, otherwise falls back to legacy beer_count
CREATE OR REPLACE FUNCTION _get_effective_drink_count(p_attendance_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF((SELECT COUNT(*)::int FROM consumptions WHERE attendance_id = p_attendance_id), 0),
    (SELECT beer_count FROM attendances WHERE id = p_attendance_id)
  );
$$;

CREATE OR REPLACE FUNCTION "public"."get_wrapped_data"("p_user_id" "uuid", "p_festival_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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
        tv.visit_date::date as date,
        COUNT(DISTINCT tv.tent_id) as tent_count
      FROM tent_visits tv
      WHERE tv.user_id = p_user_id
        AND tv.festival_id = p_festival_id
      GROUP BY tv.visit_date::date
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
            AND tv.visit_date::date = a.date
        )
      ) ORDER BY a.date ASC
    ),
    '[]'::JSONB
  ) INTO v_timeline
  FROM attendances a
  WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id;

  v_result := v_result || jsonb_build_object('timeline', v_timeline);

  -- Calculate comparisons using consumptions
  WITH festival_avg AS (
    SELECT
      ROUND(AVG(total_drinks), 2) AS avg_beers,
      ROUND(AVG(days_attended), 2) AS avg_days
    FROM (
      SELECT
        a.user_id,
        COUNT(DISTINCT a.date) AS days_attended,
        SUM(_get_effective_drink_count(a.id)) AS total_drinks
      FROM attendances a
      WHERE a.festival_id = p_festival_id
      GROUP BY a.user_id
    ) user_stats
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
      'avg_days', fa.avg_days
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
  FROM festival_avg fa, user_current uc, previous_festival pf;

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

COMMENT ON FUNCTION "public"."get_wrapped_data"("p_user_id" "uuid", "p_festival_id" "uuid") IS 'Returns comprehensive wrapped statistics for a user''s festival experience. Uses consumptions table as source of truth for drink counts, with fallback to legacy attendances.beer_count for backwards compatibility.';
