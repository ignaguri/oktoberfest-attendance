-- Personal progress for the Home card: streak, tents X of Y, the previous
-- festival in the same series, and the raw group and friend counts the API
-- uses to decide solo vs social. It returns counts only; the solo rule lives in
-- packages/shared/src/utils/home-audience.ts so it can change without a
-- migration.
--
-- Reads the caller from auth.uid() instead of taking a user id, so a signed-in
-- user cannot ask for someone else's numbers. SECURITY INVOKER: RLS applies.
-- p_today exists for tests; the API leaves it NULL and today is taken in the
-- festival's timezone.

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
  previous_festival_beers integer,
  previous_festival_days integer,
  groups_this_festival integer,
  accepted_friends integer
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
  v_series text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_festival FROM festivals WHERE id = p_festival_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_today := COALESCE(p_today, (now() AT TIME ZONE v_festival.timezone)::date);
  -- Same rule as getFestivalSeriesKey: name without the trailing year
  v_series := lower(btrim(regexp_replace(v_festival.name, '\s+\d{4}\s*$', '')));

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
    WHERE f.id <> p_festival_id
      AND f.start_date < v_festival.start_date
      AND lower(btrim(regexp_replace(f.name, '\s+\d{4}\s*$', ''))) = v_series
      AND EXISTS (
        SELECT 1 FROM attendances a WHERE a.user_id = v_user_id AND a.festival_id = f.id
      )
    ORDER BY f.start_date DESC
    LIMIT 1
  )
  SELECT
    -- Yesterday still counts, so the streak does not read 0 before today is logged
    COALESCE((SELECT r.run_length FROM runs r WHERE r.run_end >= v_today - 1 ORDER BY r.run_end DESC LIMIT 1), 0),
    COALESCE((SELECT MAX(r.run_length) FROM runs r), 0),
    (SELECT COUNT(DISTINCT tv.tent_id)::integer
       FROM tent_visits tv
      WHERE tv.user_id = v_user_id AND tv.festival_id = p_festival_id),
    (SELECT COUNT(*)::integer FROM festival_tents ft WHERE ft.festival_id = p_festival_id),
    (SELECT p.name::text FROM previous p),
    -- Drinks live in consumptions; attendances.beer_count stopped being written
    -- in 20260317130000_stop_writing_beer_count. Beer and radler, like the
    -- group leaderboard and attendance_with_totals.
    (SELECT COUNT(c.id)::integer
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
        AND (fr.requester_id = v_user_id OR fr.addressee_id = v_user_id));
END;
$$;

-- Supabase default privileges grant new functions to anon directly, so PUBLIC alone is not enough
REVOKE EXECUTE ON FUNCTION public.get_user_festival_progress(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_festival_progress(uuid, date) TO authenticated;

-- Highlights showed 0 beers for every attendance since March: this function
-- still summed attendances.beer_count, which 20260317130000_stop_writing_beer_count
-- stopped writing. Count beer and radler from consumptions instead, like the
-- group leaderboard and attendance_with_totals. Rest of the function unchanged
-- from 20260924144242_group_criteria_tents_streak.

CREATE OR REPLACE FUNCTION public.get_user_festival_stats_with_positions(p_user_id uuid, p_festival_id uuid)
 RETURNS TABLE(top_positions jsonb, total_beers bigint, days_attended bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
  user_total_beers BIGINT := 0;
  user_days_attended BIGINT := 0;
BEGIN
  -- Get user's total beers and days attended for the festival
  SELECT
    (SELECT COUNT(*)
       FROM consumptions c
       JOIN attendances a ON a.id = c.attendance_id
      WHERE a.user_id = p_user_id
        AND a.festival_id = p_festival_id
        AND c.drink_type IN ('beer', 'radler')),
    (SELECT COUNT(DISTINCT a.date)
       FROM attendances a
      WHERE a.user_id = p_user_id
        AND a.festival_id = p_festival_id)
  INTO
    user_total_beers,
    user_days_attended;

  -- Groups where the user is in the top 3 of the group's own leaderboard
  RETURN QUERY
  WITH ranked_leaderboard AS (
    SELECT
      g.id AS group_id,
      g.name AS group_name,
      member_rank.position AS user_rank,
      (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS total_members
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
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'group_id', group_id,
          'group_name', group_name,
          'position', user_rank,
          'total_members', total_members
        )
      ) FILTER (WHERE user_rank <= 3),
      '[]'::jsonb
    ) AS top_positions,
    user_total_beers AS total_beers,
    user_days_attended AS days_attended
  FROM
    ranked_leaderboard
  WHERE
    user_rank <= 3;

  -- If no groups found, still return the user's stats
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      '[]'::jsonb AS top_positions,
      user_total_beers AS total_beers,
      user_days_attended AS days_attended;
  END IF;

END;
$function$;
