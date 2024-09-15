CREATE OR REPLACE FUNCTION get_user_stats(input_user_id uuid)
RETURNS TABLE (
    top_positions jsonb,
    total_beers bigint,
    days_attended bigint
) AS $$
DECLARE
    user_total_beers bigint := 0;  -- Initialize to 0
    user_days_attended bigint := 0;  -- Initialize to 0
BEGIN
    -- Get total beers and days attended for the user
    SELECT 
        COALESCE(SUM(beer_count), 0),
        COALESCE(COUNT(DISTINCT date), 0)
    INTO user_total_beers, user_days_attended
    FROM 
        attendances
    WHERE 
        user_id = input_user_id;

    -- Get top positions from the leaderboard view, ordered by winning_criteria
    RETURN QUERY
    WITH ranked_leaderboard AS (
        SELECT 
            g.id AS group_id,
            g.name AS group_name,
            ROW_NUMBER() OVER (PARTITION BY g.id ORDER BY 
                CASE 
                    WHEN wc.name = 'total_beers' THEN SUM(a.beer_count)
                    WHEN wc.name = 'days_attended' THEN COUNT(DISTINCT a.date)
                    WHEN wc.name = 'avg_beers' THEN 
                        COALESCE(SUM(a.beer_count) / NULLIF(COUNT(DISTINCT a.date), 0), 0)  -- Calculate avg_beers
                    ELSE 0  -- Default case
                END DESC
            ) AS user_position
        FROM 
            groups g
        JOIN 
            winning_criteria wc ON g.winning_criteria_id = wc.id  -- Join with winning_criteria
        JOIN 
            group_members gm ON g.id = gm.group_id
        LEFT JOIN 
            attendances a ON a.user_id = input_user_id
        WHERE 
            gm.user_id = input_user_id  -- Ensure we only consider groups where the user is a member
        GROUP BY 
            g.id, g.name, wc.name  -- Include wc.name in GROUP BY
    )
    SELECT 
        jsonb_agg(jsonb_build_object('group_id', group_id, 'group_name', group_name)) AS top_positions,
        user_total_beers AS total_beers,
        user_days_attended AS days_attended
    FROM 
        ranked_leaderboard
    WHERE 
        user_position <= 3;  -- Only include top 3 positions
END;
$$ LANGUAGE plpgsql;
