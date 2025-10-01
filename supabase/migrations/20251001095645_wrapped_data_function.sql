-- Wrapped Data Function
-- Comprehensive function to fetch all wrapped statistics for a user's festival experience

CREATE OR REPLACE FUNCTION get_wrapped_data(
  p_user_id UUID,
  p_festival_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB := '{}'::JSONB;
  v_festival RECORD;
  v_user RECORD;
  v_basic_stats JSONB;
  v_tent_stats JSONB;
  v_peak_moments JSONB;
  v_social_stats JSONB;
  v_achievements JSONB;
  v_timeline JSONB;
  v_comparisons JSONB;
  v_personality JSONB;
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

  -- Calculate basic stats
  -- Using festival beer cost for simplified calculation (fallback: festival -> global default)
  WITH attendance_agg AS (
    SELECT
      COUNT(DISTINCT a.date) AS days_attended,
      COALESCE(SUM(a.beer_count), 0) AS total_beers,
      CASE
        WHEN COUNT(DISTINCT a.date) > 0 THEN
          ROUND(COALESCE(SUM(a.beer_count), 0)::NUMERIC / COUNT(DISTINCT a.date)::NUMERIC, 2)
        ELSE 0
      END AS avg_beers
    FROM attendances a
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
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
  WITH tent_agg AS (
    SELECT
      COUNT(DISTINCT tv.tent_id) AS unique_tents,
      (
        SELECT t.name
        FROM tent_visits tv2
        JOIN tents t ON tv2.tent_id = t.id
        WHERE tv2.user_id = p_user_id
          AND tv2.visit_date >= v_festival.start_date
          AND tv2.visit_date <= v_festival.end_date
        GROUP BY t.name, t.id
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) AS favorite_tent,
      jsonb_agg(
        jsonb_build_object(
          'tent_name', t.name,
          'visit_count', visit_count
        ) ORDER BY visit_count DESC
      ) AS tent_breakdown
    FROM tent_visits tv
    JOIN (
      SELECT
        tv2.tent_id,
        COUNT(*) AS visit_count
      FROM tent_visits tv2
      WHERE tv2.user_id = p_user_id
        AND tv2.visit_date >= v_festival.start_date
        AND tv2.visit_date <= v_festival.end_date
      GROUP BY tv2.tent_id
    ) tent_counts ON tv.tent_id = tent_counts.tent_id
    JOIN tents t ON tent_counts.tent_id = t.id
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

  -- Calculate peak moments
  WITH best_day AS (
    SELECT
      a.date,
      a.beer_count,
      ROUND(a.beer_count * v_beer_cost, 2) AS spent
    FROM attendances a
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
    ORDER BY a.beer_count DESC, a.date DESC
    LIMIT 1
  ),
  max_session AS (
    SELECT COALESCE(MAX(a.beer_count), 0) AS max_beers
    FROM attendances a
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
  ),
  most_expensive AS (
    SELECT
      a.date,
      ROUND(a.beer_count * v_beer_cost, 2) AS amount
    FROM attendances a
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
    ORDER BY (a.beer_count * v_beer_cost) DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'best_day', CASE
      WHEN bd.date IS NOT NULL THEN
        jsonb_build_object(
          'date', bd.date,
          'beer_count', bd.beer_count,
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

  -- Calculate social stats
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
              ORDER BY COALESCE(SUM(a.beer_count), 0) DESC, p.username ASC
            )
          WHEN wc.name = 'avg_beers' THEN
            ROW_NUMBER() OVER (
              PARTITION BY g.id
              ORDER BY COALESCE(AVG(a.beer_count), 0) DESC, p.username ASC
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
  )
  SELECT jsonb_build_object(
    'groups_joined', ug.groups_joined,
    'top_3_rankings', COALESCE(tr.rankings, '[]'::JSONB),
    'photos_uploaded', pc.photos_uploaded,
    'total_group_members', ug.total_group_members
  ) INTO v_social_stats
  FROM user_groups ug, top_rankings tr, photo_count pc;

  v_result := v_result || jsonb_build_object('social_stats', v_social_stats);

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

  -- Build timeline (daily progression)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'date', a.date,
        'beer_count', a.beer_count,
        'spent', ROUND(a.beer_count * v_beer_cost, 2),
        'tents_visited', (
          SELECT COUNT(DISTINCT tent_id)
          FROM tent_visits tv
          WHERE tv.user_id = p_user_id AND tv.visit_date = a.date
        )
      ) ORDER BY a.date ASC
    ),
    '[]'::JSONB
  ) INTO v_timeline
  FROM attendances a
  WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id;

  v_result := v_result || jsonb_build_object('timeline', v_timeline);

  -- Calculate comparisons
  WITH festival_avg AS (
    SELECT
      ROUND(AVG(total_beers), 2) AS avg_beers,
      ROUND(AVG(days_attended), 2) AS avg_days
    FROM (
      SELECT
        user_id,
        COUNT(DISTINCT date) AS days_attended,
        SUM(beer_count) AS total_beers
      FROM attendances
      WHERE festival_id = p_festival_id
      GROUP BY user_id
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
      COALESCE(SUM(a.beer_count), 0) AS prev_beers,
      COALESCE(SUM(a.beer_count) * v_beer_cost, 0) AS prev_spent
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

  -- Calculate personality type
  WITH user_patterns AS (
    SELECT
      (v_basic_stats->>'total_beers')::INT AS total_beers,
      (v_basic_stats->>'days_attended')::INT AS days_attended,
      (v_basic_stats->>'avg_beers')::NUMERIC AS avg_beers,
      (v_tent_stats->>'unique_tents')::INT AS unique_tents,
      (SELECT COUNT(*) FROM tents) AS total_tents,
      -- Check if early bird (attended first day)
      EXISTS (
        SELECT 1 FROM attendances
        WHERE user_id = p_user_id
          AND festival_id = p_festival_id
          AND date = v_festival.start_date
      ) AS attended_first_day,
      -- Check consistency (variance in daily beers)
      COALESCE(STDDEV(beer_count), 0) AS beer_variance
    FROM attendances
    WHERE user_id = p_user_id AND festival_id = p_festival_id
  )
  SELECT jsonb_build_object(
    'type', CASE
      -- Determine primary personality type
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
    ) - ARRAY[NULL]::TEXT[] -- Remove nulls
  ) INTO v_personality
  FROM user_patterns up;

  v_result := v_result || jsonb_build_object('personality', v_personality);

  RETURN v_result;
END;
$$;

-- Add RLS policy for wrapped data (users can only access their own wrapped data)
-- Function respects RLS automatically through underlying table queries

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_wrapped_data(UUID, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_wrapped_data(UUID, UUID) IS
  'Returns comprehensive wrapped statistics for a user''s festival experience including basic stats, tent exploration, peak moments, social stats, achievements, timeline, comparisons, and personality insights.';
