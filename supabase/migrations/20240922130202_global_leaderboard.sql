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
    WITH user_stats AS (
        SELECT 
            p.id AS user_id,
            p.username,
            p.full_name,
            p.avatar_url,
            COUNT(DISTINCT a.date) AS days_attended,
            COALESCE(SUM(a.beer_count), 0) AS total_beers,
            COALESCE(AVG(a.beer_count), 0) AS avg_beers,
            COUNT(DISTINCT gm.group_id) AS group_count
        FROM 
            profiles p
            LEFT JOIN attendances a ON p.id = a.user_id
            LEFT JOIN group_members gm ON p.id = gm.user_id
        GROUP BY 
            p.id, p.username, p.full_name, p.avatar_url
    )
    SELECT 
        user_stats.user_id,
        user_stats.username,
        user_stats.full_name,
        user_stats.avatar_url,
        user_stats.days_attended,
        user_stats.total_beers,
        user_stats.avg_beers,
        user_stats.group_count
    FROM user_stats
    ORDER BY
        CASE
            WHEN p_winning_criteria_id = (SELECT id FROM winning_criteria WHERE name = 'days_attended') THEN user_stats.days_attended
            WHEN p_winning_criteria_id = (SELECT id FROM winning_criteria WHERE name = 'total_beers') THEN user_stats.total_beers
            WHEN p_winning_criteria_id = (SELECT id FROM winning_criteria WHERE name = 'avg_beers') THEN user_stats.avg_beers
            ELSE user_stats.total_beers -- default to total_beers if criteria is not recognized
        END DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;
