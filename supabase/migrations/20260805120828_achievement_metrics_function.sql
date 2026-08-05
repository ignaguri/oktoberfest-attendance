-- Returns every achievement metric for one (user, festival) pair as a single
-- jsonb object. Keys match the AchievementMetrics interface in
-- packages/shared/src/achievements/types.ts exactly. Changing one without the
-- other silently yields zeroes.
--
-- Festival-scoped metrics use p_festival_id. Lifetime metrics ignore it.
--
-- SECURITY DEFINER: this reads across users, so the auth.uid() guard below
-- is required. It's SET search_path pinned and owned by postgres
-- (rolbypassrls = true), so it bypasses RLS on every table it reads.
-- Callers are restricted to their own user id unless super admin; anon is
-- revoked entirely below instead of trusting a guard alone.
--
-- group_wins and podium_finishes are scoped to festivals that have actually
-- concluded (f.end_date < CURRENT_DATE). Without that, whoever is leading
-- on day 2 of a still-running festival's nightly standings refresh would
-- permanently unlock a competitive achievement for a result that hasn't
-- happened yet.
CREATE OR REPLACE FUNCTION public.get_achievement_metrics(
  p_user_id uuid,
  p_festival_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    'wrapped_viewed',       (SELECT EXISTS (
                                SELECT 1 FROM wrapped_data_cache w
                                WHERE w.user_id = p_user_id AND w.first_viewed_at IS NOT NULL))
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_achievement_metrics(uuid, uuid) IS
  'Returns all achievement metrics for a (user, festival) pair as jsonb. Keys must match AchievementMetrics in packages/shared/src/achievements/types.ts. SECURITY DEFINER because it reads across RLS; callers are restricted to their own user id unless super admin.';

REVOKE EXECUTE ON FUNCTION public.get_achievement_metrics(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_achievement_metrics(uuid, uuid) TO authenticated, service_role;
