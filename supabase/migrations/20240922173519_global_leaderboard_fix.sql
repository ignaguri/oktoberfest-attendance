CREATE OR REPLACE FUNCTION get_global_leaderboard(p_winning_criteria_id INT)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    full_name TEXT,
    avatar_url TEXT,
    days_attended BIGINT,
    total_beers BIGINT,
    avg_beers NUMERIC,
    group_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH attendance_stats AS (
        SELECT 
            a.user_id AS a_user_id,
            COUNT(DISTINCT a.date) AS days_attended,
            SUM(a.beer_count) AS total_beers,
            AVG(a.beer_count) AS avg_beers
        FROM attendances a
        GROUP BY a.user_id
    ),
    group_stats AS (
        SELECT 
            gm.user_id AS g_user_id, 
            COUNT(DISTINCT gm.group_id) AS group_count
        FROM group_members gm
        GROUP BY gm.user_id
    ),
    user_stats AS (
        SELECT 
            p.id AS p_user_id,
            p.username,
            p.full_name,
            p.avatar_url,
            COALESCE(a.days_attended, 0) AS days_attended,
            COALESCE(a.total_beers, 0) AS total_beers,
            COALESCE(a.avg_beers, 0) AS avg_beers,
            COALESCE(g.group_count, 0) AS group_count
        FROM 
            profiles p
        LEFT JOIN attendance_stats a ON p.id = a.a_user_id
        LEFT JOIN group_stats g ON p.id = g.g_user_id
    )
    SELECT 
        us.p_user_id AS user_id,
        us.username,
        us.full_name,
        us.avatar_url,
        us.days_attended,
        us.total_beers,
        us.avg_beers,
        us.group_count
    FROM user_stats us
    ORDER BY
        CASE
            WHEN p_winning_criteria_id = (SELECT id FROM winning_criteria WHERE name = 'days_attended') THEN us.days_attended
            WHEN p_winning_criteria_id = (SELECT id FROM winning_criteria WHERE name = 'total_beers') THEN us.total_beers
            WHEN p_winning_criteria_id = (SELECT id FROM winning_criteria WHERE name = 'avg_beers') THEN us.avg_beers
            ELSE us.total_beers -- default to total_beers if criteria is not recognized
        END DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;
