-- Merged Wrapped Data Functions and Cache System
-- Comprehensive migration that includes both caching system and corrected wrapped data function

-- Wrapped Data Cache Table
-- Stores pre-calculated wrapped data for users to avoid expensive recalculations

CREATE TABLE IF NOT EXISTS wrapped_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  wrapped_data JSONB NOT NULL,
  generated_by TEXT NOT NULL DEFAULT 'system' CHECK (generated_by IN ('system', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one cache entry per user-festival combination
  UNIQUE(user_id, festival_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_wrapped_data_cache_user_festival
  ON wrapped_data_cache(user_id, festival_id);

-- Index for admin queries (by generation method and date)
CREATE INDEX IF NOT EXISTS idx_wrapped_data_cache_admin
  ON wrapped_data_cache(generated_by, updated_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wrapped_data_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_wrapped_data_cache_updated_at
  BEFORE UPDATE ON wrapped_data_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_wrapped_data_cache_updated_at();

-- Wrapped Data Function (CORRECTED VERSION)
-- Comprehensive function to fetch all wrapped statistics for a user's festival experience
-- Fixed tent stats calculation to prevent duplicate entries and inflated visit counts

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
  v_global_positions JSONB;
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

  -- Calculate tent stats (FIXED VERSION - prevents duplicate tent entries)
  WITH tent_stats AS (
    SELECT
      tv.tent_id,
      t.name as tent_name,
      COUNT(*) AS visit_count
    FROM tent_visits tv
    JOIN tents t ON tv.tent_id = t.id
    WHERE tv.user_id = p_user_id
      AND tv.visit_date >= v_festival.start_date
      AND tv.visit_date <= v_festival.end_date
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

  -- Calculate peak moments
  -- Best day now uses combined score (beers + tents_visited) for more comprehensive performance metric
  WITH daily_scores AS (
    SELECT
      a.date,
      a.beer_count,
      COALESCE(tv.tent_count, 0) as tents_visited,
      (a.beer_count + COALESCE(tv.tent_count, 0)) as combined_score,
      ROUND(a.beer_count * v_beer_cost, 2) AS spent
    FROM attendances a
    LEFT JOIN (
      SELECT
        tv.visit_date as date,
        COUNT(DISTINCT tv.tent_id) as tent_count
      FROM tent_visits tv
      WHERE tv.user_id = p_user_id
      GROUP BY tv.visit_date
    ) tv ON a.date = tv.date
    WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
  ),
  best_day AS (
    SELECT
      ds.date,
      ds.beer_count,
      ds.tents_visited,
      ds.spent
    FROM daily_scores ds
    ORDER BY ds.combined_score DESC, ds.date DESC
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
    LIMIT 20 -- Limit to prevent excessive data
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

-- Function to get cached wrapped data or calculate if not exists
CREATE OR REPLACE FUNCTION get_wrapped_data_cached(
  p_user_id UUID,
  p_festival_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_cached_data JSONB;
  v_calculated_data JSONB;
BEGIN
  -- Try to get cached data first
  SELECT wrapped_data INTO v_cached_data
  FROM wrapped_data_cache
  WHERE user_id = p_user_id AND festival_id = p_festival_id;

  -- If cached data exists, return it
  IF v_cached_data IS NOT NULL THEN
    RETURN v_cached_data;
  END IF;

  -- Otherwise, calculate fresh data
  SELECT get_wrapped_data(p_user_id, p_festival_id) INTO v_calculated_data;

  -- If calculation returned data, cache it
  IF v_calculated_data IS NOT NULL THEN
    INSERT INTO wrapped_data_cache (user_id, festival_id, wrapped_data, generated_by)
    VALUES (p_user_id, p_festival_id, v_calculated_data, 'system')
    ON CONFLICT (user_id, festival_id)
    DO UPDATE SET
      wrapped_data = EXCLUDED.wrapped_data,
      generated_by = EXCLUDED.generated_by,
      updated_at = NOW();
  END IF;

  RETURN v_calculated_data;
END;
$$;

-- Function for admins to regenerate cached data
CREATE OR REPLACE FUNCTION regenerate_wrapped_data_cache(
  p_user_id UUID DEFAULT NULL,
  p_festival_id UUID DEFAULT NULL,
  p_admin_user_id UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_regenerated_count INTEGER := 0;
  v_query TEXT;
BEGIN
  -- Verify admin permissions (you can customize this based on your admin system)
  IF p_admin_user_id IS NOT NULL THEN
    -- Check if user is super admin
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = p_admin_user_id
      AND is_super_admin = true
    ) THEN
      RAISE EXCEPTION 'Insufficient permissions to regenerate cache';
    END IF;
  END IF;

  -- Build dynamic query based on provided parameters
  v_query := '
    WITH calculated_data AS (
      SELECT
        wdc.user_id,
        wdc.festival_id,
        get_wrapped_data(wdc.user_id, wdc.festival_id) as new_data
      FROM wrapped_data_cache wdc
      WHERE 1=1';

  IF p_user_id IS NOT NULL THEN
    v_query := v_query || ' AND wdc.user_id = $1';
  END IF;

  IF p_festival_id IS NOT NULL THEN
    v_query := v_query || ' AND wdc.festival_id = $2';
  END IF;

  v_query := v_query || '
    )
    UPDATE wrapped_data_cache
    SET
      wrapped_data = calculated_data.new_data,
      generated_by = ''admin'',
      updated_at = NOW()
    FROM calculated_data
    WHERE wrapped_data_cache.user_id = calculated_data.user_id
      AND wrapped_data_cache.festival_id = calculated_data.festival_id
      AND calculated_data.new_data IS NOT NULL';

  -- Execute the query with appropriate parameters
  IF p_user_id IS NOT NULL AND p_festival_id IS NOT NULL THEN
    EXECUTE v_query USING p_user_id, p_festival_id;
    GET DIAGNOSTICS v_regenerated_count = ROW_COUNT;
  ELSIF p_user_id IS NOT NULL THEN
    EXECUTE v_query USING p_user_id;
    GET DIAGNOSTICS v_regenerated_count = ROW_COUNT;
  ELSIF p_festival_id IS NOT NULL THEN
    EXECUTE v_query USING p_festival_id;
    GET DIAGNOSTICS v_regenerated_count = ROW_COUNT;
  ELSE
    EXECUTE v_query;
    GET DIAGNOSTICS v_regenerated_count = ROW_COUNT;
  END IF;

  RETURN v_regenerated_count;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_wrapped_data(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_wrapped_data_cached(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION regenerate_wrapped_data_cache(UUID, UUID, UUID) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION get_wrapped_data(UUID, UUID) IS
  'Returns comprehensive wrapped statistics for a user''s festival experience including basic stats, tent exploration, peak moments, social stats, achievements, timeline, comparisons, and personality insights.';

COMMENT ON FUNCTION get_wrapped_data_cached(UUID, UUID) IS
  'Returns cached wrapped data if available, otherwise calculates and caches fresh data.';

COMMENT ON FUNCTION regenerate_wrapped_data_cache(UUID, UUID, UUID) IS
  'Admin function to regenerate cached wrapped data for specific users/festivals.';

-- Enable RLS and create policies
ALTER TABLE wrapped_data_cache ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own cached data
CREATE POLICY "Users can view own wrapped cache" ON wrapped_data_cache
  FOR SELECT USING (auth.uid() = user_id);

-- Policy for admins to manage cache (you can customize this)
CREATE POLICY "Admins can manage wrapped cache" ON wrapped_data_cache
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_super_admin = true
    )
  );

-- Cache invalidation functions
CREATE OR REPLACE FUNCTION invalidate_wrapped_cache(
  p_user_id UUID,
  p_festival_id UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  -- Delete cache entries for the user (and specific festival if provided)
  IF p_festival_id IS NOT NULL THEN
    DELETE FROM wrapped_data_cache
    WHERE user_id = p_user_id AND festival_id = p_festival_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  ELSE
    DELETE FROM wrapped_data_cache WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  END IF;

  RETURN v_deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION invalidate_festival_wrapped_cache(
  p_festival_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  DELETE FROM wrapped_data_cache WHERE festival_id = p_festival_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

-- Trigger functions for automatic cache invalidation
CREATE OR REPLACE FUNCTION trigger_wrapped_cache_invalidation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Invalidate cache for this user and festival when attendance data changes
  PERFORM invalidate_wrapped_cache(COALESCE(NEW.user_id, OLD.user_id), COALESCE(NEW.festival_id, OLD.festival_id));

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION trigger_tent_visit_cache_invalidation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_festival_id UUID;
BEGIN
  -- Get user_id and festival_id from attendance record
  SELECT a.user_id, a.festival_id INTO v_user_id, v_festival_id
  FROM attendances a
  WHERE a.id = COALESCE(NEW.attendance_id, OLD.attendance_id);

  -- Invalidate cache for this user and festival
  IF v_user_id IS NOT NULL AND v_festival_id IS NOT NULL THEN
    PERFORM invalidate_wrapped_cache(v_user_id, v_festival_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION trigger_achievement_cache_invalidation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_festival_id UUID;
BEGIN
  -- Get user_id from achievement record
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  -- For achievements, we need to invalidate cache for all festivals this user participated in
  -- This is a simplified approach - in a real scenario you might want to be more specific
  PERFORM invalidate_wrapped_cache(v_user_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers to invalidate cache when relevant data changes
DROP TRIGGER IF EXISTS tr_attendances_wrapped_cache_invalidation ON attendances;
CREATE TRIGGER tr_attendances_wrapped_cache_invalidation
  AFTER INSERT OR UPDATE OR DELETE ON attendances
  FOR EACH ROW EXECUTE FUNCTION trigger_wrapped_cache_invalidation();

DROP TRIGGER IF EXISTS tr_tent_visits_wrapped_cache_invalidation ON tent_visits;
CREATE TRIGGER tr_tent_visits_wrapped_cache_invalidation
  AFTER INSERT OR UPDATE OR DELETE ON tent_visits
  FOR EACH ROW EXECUTE FUNCTION trigger_tent_visit_cache_invalidation();

DROP TRIGGER IF EXISTS tr_user_achievements_wrapped_cache_invalidation ON user_achievements;
CREATE TRIGGER tr_user_achievements_wrapped_cache_invalidation
  AFTER INSERT OR UPDATE OR DELETE ON user_achievements
  FOR EACH ROW EXECUTE FUNCTION trigger_achievement_cache_invalidation();
