-- Two more group winning criteria: most tents visited (4) and longest streak
-- of consecutive festival days (5). Rows 1-3 came from the seed, so these are
-- inserted here to reach prod.
INSERT INTO public.winning_criteria (id, name) VALUES
  (4, 'tents_visited'),
  (5, 'longest_streak')
ON CONFLICT (id) DO NOTHING;

-- The return type changes, so the function has to be dropped. It stays
-- SECURITY INVOKER with default grants, as before: group members can read
-- each other's attendances and tent_visits through RLS.
DROP FUNCTION IF EXISTS public.get_group_leaderboard(uuid, integer);

CREATE FUNCTION public.get_group_leaderboard(
  p_group_id uuid,
  p_winning_criteria_id integer
)
RETURNS TABLE(
  user_id uuid,
  username text,
  full_name text,
  avatar_url text,
  group_id uuid,
  group_name character varying,
  festival_id uuid,
  festival_name character varying,
  days_attended bigint,
  total_beers numeric,
  avg_beers numeric,
  tents_visited bigint,
  longest_streak bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH member_stats AS (
        SELECT
            p.id AS p_user_id,
            p.username::TEXT AS p_username,
            p.full_name::TEXT AS p_full_name,
            p.avatar_url::TEXT AS p_avatar_url,
            g.id AS g_id,
            g.name AS g_name,
            g.festival_id AS g_festival_id,
            f.name AS f_name,
            COUNT(DISTINCT a.date)::BIGINT AS ms_days,
            COALESCE(SUM(
                CASE
                    WHEN c.drink_type = 'radler' THEN 0.5
                    WHEN c.drink_type = 'beer' THEN 1.0
                    ELSE 0
                END
            ), 0)::NUMERIC AS ms_beers
        FROM profiles p
        INNER JOIN group_members gm ON p.id = gm.user_id
        INNER JOIN groups g ON gm.group_id = g.id
        INNER JOIN festivals f ON g.festival_id = f.id
        LEFT JOIN attendances a ON p.id = a.user_id AND a.festival_id = g.festival_id
        LEFT JOIN consumptions c
            ON c.attendance_id = a.id
            AND c.drink_type IN ('beer', 'radler')
        WHERE gm.group_id = p_group_id
        GROUP BY p.id, p.username, p.full_name, p.avatar_url, g.id, g.name, g.festival_id, f.name
    ),
    member_tents AS (
        SELECT tv.user_id AS mt_user_id, COUNT(DISTINCT tv.tent_id)::BIGINT AS mt_tents
        FROM tent_visits tv
        INNER JOIN group_members gm ON gm.user_id = tv.user_id AND gm.group_id = p_group_id
        INNER JOIN groups g ON g.id = p_group_id AND tv.festival_id = g.festival_id
        GROUP BY tv.user_id
    ),
    member_dates AS (
        SELECT DISTINCT a.user_id AS md_user_id, a.date AS md_date
        FROM attendances a
        INNER JOIN group_members gm ON gm.user_id = a.user_id AND gm.group_id = p_group_id
        INNER JOIN groups g ON g.id = p_group_id AND a.festival_id = g.festival_id
    ),
    member_runs AS (
        -- Consecutive dates share the same (date - row_number) anchor
        SELECT md_user_id AS mr_user_id, COUNT(*)::BIGINT AS mr_length
        FROM (
            SELECT
                md_user_id,
                md_date - (ROW_NUMBER() OVER (PARTITION BY md_user_id ORDER BY md_date))::INTEGER AS anchor
            FROM member_dates
        ) runs
        GROUP BY md_user_id, anchor
    ),
    member_streaks AS (
        SELECT mr_user_id AS mst_user_id, MAX(mr_length)::BIGINT AS mst_streak
        FROM member_runs
        GROUP BY mr_user_id
    )
    SELECT
        ms.p_user_id AS user_id,
        ms.p_username AS username,
        ms.p_full_name AS full_name,
        ms.p_avatar_url AS avatar_url,
        ms.g_id AS group_id,
        ms.g_name AS group_name,
        ms.g_festival_id AS festival_id,
        ms.f_name AS festival_name,
        ms.ms_days AS days_attended,
        ms.ms_beers AS total_beers,
        CASE
            WHEN ms.ms_days > 0 THEN ROUND(ms.ms_beers / ms.ms_days::NUMERIC, 2)
            ELSE 0
        END AS avg_beers,
        COALESCE(mt.mt_tents, 0)::BIGINT AS tents_visited,
        COALESCE(mst.mst_streak, 0)::BIGINT AS longest_streak
    FROM member_stats ms
    LEFT JOIN member_tents mt ON mt.mt_user_id = ms.p_user_id
    LEFT JOIN member_streaks mst ON mst.mst_user_id = ms.p_user_id
    ORDER BY
        CASE
            WHEN p_winning_criteria_id = 1 THEN ms.ms_days::NUMERIC
            WHEN p_winning_criteria_id = 2 THEN ms.ms_beers
            WHEN p_winning_criteria_id = 3 THEN
                CASE WHEN ms.ms_days > 0 THEN ms.ms_beers / ms.ms_days::NUMERIC ELSE 0 END
            WHEN p_winning_criteria_id = 4 THEN COALESCE(mt.mt_tents, 0)::NUMERIC
            WHEN p_winning_criteria_id = 5 THEN COALESCE(mst.mst_streak, 0)::NUMERIC
            ELSE ms.ms_beers
        END DESC,
        ms.ms_beers DESC,
        ms.p_user_id;
END;
$$;

-- Same body as 20260805122744, plus cases 4 and 5.
CREATE OR REPLACE FUNCTION public.refresh_festival_group_standings(
  p_festival_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Rank by the group's OWN winning criteria, mirroring the ordering inside
    -- get_group_leaderboard.
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
            WHEN 4 THEN lb.tents_visited::numeric
            WHEN 5 THEN lb.longest_streak::numeric
            ELSE lb.total_beers
          END DESC,
          lb.total_beers DESC,
          lb.user_id
      ),
      count(*) OVER (),
      v_group.winning_criteria_id
    FROM get_group_leaderboard(v_group.id, v_group.winning_criteria_id) lb
    -- A tent visit has no attendance FK, so it counts as activity on its own
    WHERE lb.total_beers > 0 OR lb.days_attended > 0 OR lb.tents_visited > 0
    ON CONFLICT (festival_id, group_id, user_id) DO NOTHING;
  END LOOP;

  SELECT count(*) INTO v_rows_written
  FROM festival_group_standings WHERE festival_id = p_festival_id;

  RETURN v_rows_written;
END;
$$;
