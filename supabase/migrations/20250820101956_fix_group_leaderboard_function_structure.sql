-- Fix group leaderboard function to return same structure as leaderboard view

DROP FUNCTION IF EXISTS public.get_group_leaderboard(uuid, integer);

CREATE OR REPLACE FUNCTION public.get_group_leaderboard(
    p_group_id uuid,
    p_winning_criteria_id integer
)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    full_name TEXT,
    avatar_url TEXT,
    group_id UUID,
    group_name VARCHAR(255),
    festival_id UUID,
    festival_name VARCHAR(255),
    days_attended BIGINT,
    total_beers BIGINT,
    avg_beers NUMERIC
) AS $$
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
        COALESCE(SUM(a.beer_count), 0)::BIGINT AS total_beers,
        CASE 
            WHEN COUNT(DISTINCT a.date) > 0 THEN 
                ROUND(COALESCE(SUM(a.beer_count), 0)::NUMERIC / COUNT(DISTINCT a.date)::NUMERIC, 2)
            ELSE 0
        END AS avg_beers
    FROM profiles p
    INNER JOIN group_members gm ON p.id = gm.user_id
    INNER JOIN groups g ON gm.group_id = g.id
    INNER JOIN festivals f ON g.festival_id = f.id
    LEFT JOIN attendances a ON p.id = a.user_id AND a.festival_id = g.festival_id
    WHERE gm.group_id = p_group_id
    GROUP BY p.id, p.username, p.full_name, p.avatar_url, g.id, g.name, g.festival_id, f.name
    ORDER BY
        CASE 
            WHEN p_winning_criteria_id = 1 THEN COUNT(DISTINCT a.date)
            WHEN p_winning_criteria_id = 2 THEN COALESCE(SUM(a.beer_count), 0)
            WHEN p_winning_criteria_id = 3 THEN 
                CASE 
                    WHEN COUNT(DISTINCT a.date) > 0 THEN 
                        COALESCE(SUM(a.beer_count), 0)::NUMERIC / COUNT(DISTINCT a.date)::NUMERIC
                    ELSE 0
                END
            ELSE COALESCE(SUM(a.beer_count), 0)
        END DESC;
END;
$$ LANGUAGE plpgsql;