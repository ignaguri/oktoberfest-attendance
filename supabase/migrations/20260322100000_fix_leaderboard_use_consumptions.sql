-- Fix leaderboard functions to count beers from consumptions table
-- instead of the deprecated attendances.beer_count column.
--
-- The app now creates attendances with beer_count=0 and tracks individual
-- drinks in the consumptions table. The leaderboard was still reading
-- attendances.beer_count, resulting in 0 beers for everyone.

-- =============================================================================
-- get_global_leaderboard: count beers from consumptions via JOIN
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_global_leaderboard(
  p_winning_criteria_id integer,
  p_festival_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  user_id uuid,
  username text,
  full_name text,
  avatar_url text,
  days_attended bigint,
  total_beers bigint,
  avg_beers numeric,
  group_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH attendance_stats AS (
        SELECT
            a.user_id AS a_user_id,
            COUNT(DISTINCT a.date)::BIGINT AS days_attended,
            COUNT(c.id)::BIGINT AS total_beers
        FROM attendances a
        LEFT JOIN consumptions c
            ON c.attendance_id = a.id
            AND c.drink_type IN ('beer', 'radler')
        WHERE (p_festival_id IS NULL OR a.festival_id = p_festival_id)
        GROUP BY a.user_id
    ),
    group_stats AS (
        SELECT
            gm.user_id AS g_user_id,
            COUNT(DISTINCT gm.group_id)::BIGINT AS group_count
        FROM group_members gm
        JOIN groups g ON gm.group_id = g.id
        WHERE (p_festival_id IS NULL OR g.festival_id = p_festival_id)
        GROUP BY gm.user_id
    )
    SELECT
        p.id AS user_id,
        p.username::TEXT AS username,
        p.full_name::TEXT AS full_name,
        p.avatar_url::TEXT AS avatar_url,
        COALESCE(ast.days_attended, 0) AS days_attended,
        COALESCE(ast.total_beers, 0) AS total_beers,
        CASE
            WHEN COALESCE(ast.days_attended, 0) > 0 THEN
                ROUND(COALESCE(ast.total_beers, 0)::NUMERIC / ast.days_attended::NUMERIC, 2)
            ELSE 0
        END AS avg_beers,
        COALESCE(gs.group_count, 0) AS group_count
    FROM profiles p
    LEFT JOIN attendance_stats ast ON p.id = ast.a_user_id
    LEFT JOIN group_stats gs ON p.id = gs.g_user_id
    WHERE
        (p_festival_id IS NULL OR ast.a_user_id IS NOT NULL)
        AND (ast.days_attended > 0 OR ast.total_beers > 0)
    ORDER BY
        CASE
            WHEN p_winning_criteria_id = 1 THEN COALESCE(ast.days_attended, 0)
            WHEN p_winning_criteria_id = 2 THEN COALESCE(ast.total_beers, 0)
            WHEN p_winning_criteria_id = 3 THEN
                CASE
                    WHEN COALESCE(ast.days_attended, 0) > 0 THEN
                        COALESCE(ast.total_beers, 0)::NUMERIC / ast.days_attended::NUMERIC
                    ELSE 0
                END
            ELSE COALESCE(ast.total_beers, 0)
        END DESC;
END;
$$;

-- =============================================================================
-- get_group_leaderboard: count beers from consumptions via JOIN
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_group_leaderboard(
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
  total_beers bigint,
  avg_beers numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS user_id,
        p.username::TEXT AS username,
        p.full_name::TEXT AS full_name,
        p.avatar_url::TEXT AS avatar_url,
        g.id AS group_id,
        g.name AS group_name,
        g.festival_id,
        f.name AS festival_name,
        COUNT(DISTINCT a.date)::BIGINT AS days_attended,
        COUNT(c.id)::BIGINT AS total_beers,
        CASE
            WHEN COUNT(DISTINCT a.date) > 0 THEN
                ROUND(COUNT(c.id)::NUMERIC / COUNT(DISTINCT a.date)::NUMERIC, 2)
            ELSE 0
        END AS avg_beers
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
    ORDER BY
        CASE
            WHEN p_winning_criteria_id = 1 THEN COUNT(DISTINCT a.date)
            WHEN p_winning_criteria_id = 2 THEN COUNT(c.id)
            WHEN p_winning_criteria_id = 3 THEN
                CASE
                    WHEN COUNT(DISTINCT a.date) > 0 THEN
                        COUNT(c.id)::NUMERIC / COUNT(DISTINCT a.date)::NUMERIC
                    ELSE 0
                END
            ELSE COUNT(c.id)
        END DESC;
END;
$$;
