-- Two fixes to the competitive achievements' standings pipeline, both found
-- during the whole-branch review of the achievements engine (feat/achievements-revamp).

-- 1. refresh_festival_group_standings ranked EVERY group member, including
--    ones with zero attendance and zero drinks. get_group_leaderboard LEFT
--    JOINs attendances/consumptions, so an inactive member still appears
--    with total_beers=0, days_attended=0, and row_number() still assigns
--    someone rank 1 (whoever wins the user_id tiebreak). The moment a group
--    is created in an active festival and the nightly cron runs, one member
--    unlocks group_wins/podium_finishes before anyone has done anything.
--    Fix: only rank members with real activity.
CREATE OR REPLACE FUNCTION public.refresh_festival_group_standings(p_festival_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_group record;
  v_rows_written integer := 0;
BEGIN
  DELETE FROM festival_group_standings WHERE festival_id = p_festival_id;

  FOR v_group IN
    SELECT g.id, g.winning_criteria_id
    FROM groups g
    WHERE g.festival_id = p_festival_id
  LOOP
    INSERT INTO festival_group_standings
      (festival_id, group_id, user_id, rank, member_count, criteria_id)
    SELECT
      p_festival_id,
      v_group.id,
      lb.user_id,
      row_number() OVER (
        ORDER BY
          CASE v_group.winning_criteria_id
            WHEN 1 THEN lb.days_attended::numeric
            WHEN 2 THEN lb.total_beers
            WHEN 3 THEN lb.avg_beers
            ELSE lb.total_beers
          END DESC,
          lb.total_beers DESC,
          lb.user_id
      ),
      count(*) OVER (),
      v_group.winning_criteria_id
    FROM get_group_leaderboard(v_group.id, v_group.winning_criteria_id) lb
    WHERE lb.total_beers > 0 OR lb.days_attended > 0
    ON CONFLICT (festival_id, group_id, user_id) DO NOTHING;
  END LOOP;

  SELECT count(*) INTO v_rows_written
  FROM festival_group_standings WHERE festival_id = p_festival_id;

  RETURN v_rows_written;
END;
$function$;

-- 2. get_achievement_metrics counted rank=1 from ANY standings snapshot,
--    including the active festival's nightly refresh mid-competition.
--    Whoever is leading on day 2 of a festival unlocks Champion permanently,
--    even if they finish last. Scope group_wins/podium_finishes to festivals
--    that have actually concluded.
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
                                    AND f.end_date <= CURRENT_DATE),
    'podium_finishes',         (SELECT count(*) FROM festival_group_standings s
                                  JOIN festivals f ON f.id = s.festival_id
                                  WHERE s.user_id = p_user_id AND s.rank <= 3 AND s.member_count >= 2
                                    AND f.end_date <= CURRENT_DATE),
    'active_days_total',       (SELECT count(*) FROM user_active_days uad
                                  WHERE uad.user_id = p_user_id),
    'active_day_streak_max',   (SELECT max_streak FROM active_streak),
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
    'wrapped_viewed',       (SELECT EXISTS (
                                SELECT 1 FROM wrapped_data_cache w
                                WHERE w.user_id = p_user_id AND w.first_viewed_at IS NOT NULL))
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
