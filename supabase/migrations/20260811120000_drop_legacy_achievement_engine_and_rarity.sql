-- Retire the legacy achievement engine and the redundant achievements.rarity column.
--
-- Two independent pieces of dead weight, dropped together because they are
-- entangled: the legacy engine's evaluate_user_achievements was pinned by an
-- API route until that route was deleted, and the rarity column was read by a
-- trigger function, get_wrapped_data and the activity_feed view.
--
-- The legacy engine is installed and its four triggers are ENABLED on
-- attendances, beer_pictures, group_members and tent_visits, but it is inert:
-- check_achievement_conditions matches achievements on `name`, which the
-- revamp turned into an i18n key, so it matches nothing. No user_achievements
-- rows have been written by it since the outbox shipped. The cost is a loop
-- over all 90 active achievements on every one of those writes.
--
-- achievements.rarity is fully derivable from achievements.tier and disagrees
-- with the derived value in 0 of 90 rows, so dropping it loses no information.
-- One SQL helper, tier_to_rarity(int), replaces the expression in all three
-- readers rather than duplicating a CASE three times. It is the SQL twin of
-- tierToRarity() in packages/shared/src/achievements/badge-tokens.ts, and
-- pending-unlocks.integration.test.ts pins the two to the same answers.
--
-- achievement_rarity_enum is deliberately RETAINED: achievement_events.rarity
-- uses it, and the notification cron filters group pushes on that column.
--
-- Order matters. activity_feed reads achievements.rarity, so the DROP COLUMN
-- at the end fails with a dependency error unless the view is replaced first.
-- The whole file is one transaction, so the database is never half-migrated.
--
-- DEPLOY ORDER: this migration requires the code that stopped selecting
-- achievements.rarity to be deployed FIRST. Reversed, the achievements
-- repository and the notification cron select a dropped column, producing
-- 500s on the achievements screen and breaking pushes.

-- 1. The shared derivation. IMMUTABLE because the mapping is pure.
CREATE OR REPLACE FUNCTION public.tier_to_rarity(p_tier integer)
RETURNS public.achievement_rarity_enum
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO ''
AS $$
  SELECT (
    CASE p_tier
      WHEN 2 THEN 'rare'
      WHEN 3 THEN 'epic'
      WHEN 4 THEN 'legendary'
      ELSE 'common'
    END
  )::public.achievement_rarity_enum;
$$;

COMMENT ON FUNCTION public.tier_to_rarity(integer) IS
  'Maps an achievement tier (1-4) onto the rarity vocabulary. SQL twin of tierToRarity() in @prostcounter/shared. NULL and out-of-range tiers answer common.';

-- anon is granted deliberately: activity_feed is a security_invoker view, so
-- the calling role executes this. Revoking from anon would turn today's "anon
-- selects the view and gets zero rows" into a permission error.
REVOKE EXECUTE ON FUNCTION public.tier_to_rarity(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tier_to_rarity(integer) TO anon, authenticated, service_role;

-- 2. The outbox trigger function. Highest-risk object here: it backs the
-- ENABLED trigger trg_user_achievements_insert_event, so if it throws the
-- user_achievements INSERT fails, and evaluateAfterWrite catches and logs,
-- which would break unlocking silently.
CREATE OR REPLACE FUNCTION public.insert_achievement_event_from_unlock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rarity achievement_rarity_enum;
BEGIN
  SELECT tier_to_rarity(tier) INTO v_rarity FROM achievements WHERE id = NEW.achievement_id;
  INSERT INTO achievement_events (user_id, festival_id, achievement_id, rarity)
  VALUES (NEW.user_id, NEW.festival_id, NEW.achievement_id, v_rarity);
  RETURN NEW;
END;
$function$;

-- 3. Wrapped. Body extracted with pg_get_functiondef and substituted
-- programmatically, one changed line: the rarity entry in the per-achievement
-- JSON payload. Not hand-transcribed.
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
$function$

;

-- 4. The activity feed. Same extraction. Replacing the view is also what
-- clears the dependency that would otherwise block the DROP COLUMN below.
CREATE OR REPLACE VIEW public.activity_feed WITH (security_invoker = true) AS
 WITH user_group_members AS (
         SELECT DISTINCT gm2.user_id,
            gm2.group_id,
            g.festival_id
           FROM group_members gm1
             JOIN group_members gm2 ON gm1.group_id = gm2.group_id
             JOIN groups g ON g.id = gm1.group_id
          WHERE gm1.user_id = auth.uid() AND gm2.user_id <> auth.uid()
        ), user_friends AS (
         SELECT
                CASE
                    WHEN f.requester_id = auth.uid() THEN f.addressee_id
                    ELSE f.requester_id
                END AS user_id
           FROM friendships f
          WHERE f.status = 'accepted'::friendship_status AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
        ), visible_users AS (
         SELECT DISTINCT user_group_members.user_id,
            user_group_members.festival_id
           FROM user_group_members
        UNION
         SELECT DISTINCT uf.user_id,
            a.festival_id
           FROM user_friends uf
             JOIN attendances a ON a.user_id = uf.user_id
          WHERE GREATEST(a.created_at, a.updated_at) > (now() - '48:00:00'::interval)
        ), recent_consumptions AS (
         SELECT a.user_id,
            a.festival_id,
            'beer_count_update'::activity_type_enum AS activity_type,
            jsonb_build_object('drink_type', c.drink_type::text, 'drink_count', count(*)::integer, 'beer_count', count(*)::integer, 'date', a.date, 'attendance_id', a.id) AS activity_data,
            max(c.recorded_at) AS activity_time,
            min(c.created_at) AS created_at,
            max(c.updated_at) AS updated_at
           FROM consumptions c
             JOIN attendances a ON a.id = c.attendance_id
             JOIN visible_users vu ON vu.user_id = a.user_id AND vu.festival_id = a.festival_id
          WHERE c.recorded_at > (now() - '48:00:00'::interval)
          GROUP BY a.user_id, a.festival_id, a.id, a.date, c.drink_type
        ), recent_tent_visits AS (
         SELECT tv.user_id,
            tv.festival_id,
            'tent_checkin'::activity_type_enum AS activity_type,
            jsonb_build_object('tent_id', tv.tent_id, 'tent_name', t.name, 'visit_date', tv.visit_date) AS activity_data,
            tv.visit_date AS activity_time,
            tv.visit_date AS created_at,
            tv.visit_date AS updated_at
           FROM tent_visits tv
             JOIN tents t ON t.id = tv.tent_id
             JOIN visible_users vu ON vu.user_id = tv.user_id AND vu.festival_id = tv.festival_id
          WHERE tv.visit_date > (now() - '48:00:00'::interval)
        ), recent_photos AS (
         SELECT bp.user_id,
            a.festival_id,
            'photo_upload'::activity_type_enum AS activity_type,
            jsonb_build_object('picture_url', bp.picture_url, 'attendance_id', bp.attendance_id, 'date', a.date) AS activity_data,
            bp.created_at AS activity_time,
            bp.created_at,
            bp.created_at AS updated_at
           FROM beer_pictures bp
             JOIN attendances a ON a.id = bp.attendance_id
             JOIN visible_users vu ON vu.user_id = bp.user_id AND vu.festival_id = a.festival_id
          WHERE bp.created_at > (now() - '48:00:00'::interval) AND bp.visibility = 'public'::photo_visibility_enum
        ), recent_group_joins AS (
         SELECT gm.user_id,
            g.festival_id,
            'group_join'::activity_type_enum AS activity_type,
            jsonb_build_object('group_id', g.id, 'group_name', g.name) AS activity_data,
            gm.joined_at AS activity_time,
            gm.joined_at AS created_at,
            gm.joined_at AS updated_at
           FROM group_members gm
             JOIN groups g ON g.id = gm.group_id
             JOIN visible_users vu ON vu.user_id = gm.user_id AND vu.festival_id = g.festival_id
          WHERE gm.joined_at > (now() - '48:00:00'::interval)
        ), recent_achievements AS (
         SELECT ua.user_id,
            ua.festival_id,
            'achievement_unlock'::activity_type_enum AS activity_type,
            jsonb_build_object('achievement_id', ua.achievement_id, 'achievement_name', ach.name, 'achievement_icon', ach.icon, 'rarity', tier_to_rarity(ach.tier)) AS activity_data,
            ua.unlocked_at AS activity_time,
            ua.unlocked_at AS created_at,
            ua.unlocked_at AS updated_at
           FROM user_achievements ua
             JOIN achievements ach ON ach.id = ua.achievement_id
             JOIN visible_users vu ON vu.user_id = ua.user_id AND vu.festival_id = ua.festival_id
          WHERE ua.unlocked_at > (now() - '48:00:00'::interval)
        ), all_activities AS (
         SELECT recent_consumptions.user_id,
            recent_consumptions.festival_id,
            recent_consumptions.activity_type,
            recent_consumptions.activity_data,
            recent_consumptions.activity_time,
            recent_consumptions.created_at,
            recent_consumptions.updated_at
           FROM recent_consumptions
        UNION ALL
         SELECT recent_tent_visits.user_id,
            recent_tent_visits.festival_id,
            recent_tent_visits.activity_type,
            recent_tent_visits.activity_data,
            recent_tent_visits.activity_time,
            recent_tent_visits.created_at,
            recent_tent_visits.updated_at
           FROM recent_tent_visits
        UNION ALL
         SELECT recent_photos.user_id,
            recent_photos.festival_id,
            recent_photos.activity_type,
            recent_photos.activity_data,
            recent_photos.activity_time,
            recent_photos.created_at,
            recent_photos.updated_at
           FROM recent_photos
        UNION ALL
         SELECT recent_group_joins.user_id,
            recent_group_joins.festival_id,
            recent_group_joins.activity_type,
            recent_group_joins.activity_data,
            recent_group_joins.activity_time,
            recent_group_joins.created_at,
            recent_group_joins.updated_at
           FROM recent_group_joins
        UNION ALL
         SELECT recent_achievements.user_id,
            recent_achievements.festival_id,
            recent_achievements.activity_type,
            recent_achievements.activity_data,
            recent_achievements.activity_time,
            recent_achievements.created_at,
            recent_achievements.updated_at
           FROM recent_achievements
        )
 SELECT aa.user_id,
    aa.festival_id,
    aa.activity_type,
    aa.activity_data,
    aa.activity_time,
    p.username,
    p.full_name,
    p.avatar_url
   FROM all_activities aa
     JOIN profiles p ON p.id = aa.user_id
  ORDER BY aa.activity_time DESC;
;

-- 5. The four inert triggers.
DROP TRIGGER IF EXISTS achievements_on_attendance_change ON public.attendances;
DROP TRIGGER IF EXISTS achievements_on_beer_picture_change ON public.beer_pictures;
DROP TRIGGER IF EXISTS achievements_on_group_member_change ON public.group_members;
DROP TRIGGER IF EXISTS achievements_on_tent_visit_change ON public.tent_visits;

-- 6. The legacy engine. get_user_achievements and unlock_achievement were
-- missing from the original plan's drop list; both exist and both are dead
-- outside generated types. calculate_achievement_progress has no caller at all.
DROP FUNCTION IF EXISTS public.trigger_evaluate_achievements();
DROP FUNCTION IF EXISTS public.evaluate_user_achievements(uuid, uuid);
DROP FUNCTION IF EXISTS public.check_achievement_conditions(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.unlock_achievement(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.calculate_achievement_progress(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_user_achievements(uuid, uuid);
DROP FUNCTION IF EXISTS public.evaluate_achievement_progress(uuid, uuid, uuid);

-- 7. The column. idx_achievements_rarity drops with it automatically.
-- achievement_rarity_enum stays: achievement_events.rarity still uses it.
ALTER TABLE public.achievements DROP COLUMN rarity;
