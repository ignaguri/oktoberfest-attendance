-- Update group and leaderboard functions for festival awareness

-- Update join_group function to be festival-aware
DROP FUNCTION IF EXISTS public.join_group(uuid, character varying, character varying);

CREATE OR REPLACE FUNCTION public.join_group(
    p_user_id uuid, 
    p_group_name character varying, 
    p_password character varying,
    p_festival_id uuid DEFAULT NULL
) 
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_group_id UUID;
BEGIN
  -- Check if the group exists and the password is correct
  -- If festival_id is provided, match by festival_id as well
  IF p_festival_id IS NOT NULL THEN
    SELECT id INTO v_group_id
    FROM groups
    WHERE name = p_group_name 
      AND password = p_password 
      AND festival_id = p_festival_id;
  ELSE
    -- Fallback to old behavior for backward compatibility
    SELECT id INTO v_group_id
    FROM groups
    WHERE name = p_group_name AND password = p_password
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid group name, password, or festival';
  END IF;
  
  -- Check if user is already a member
  IF EXISTS (SELECT 1 FROM group_members WHERE group_id = v_group_id AND user_id = p_user_id) THEN
    RETURN v_group_id; -- User is already a member, return the group_id
  END IF;
  
  -- Insert the user into the group
  INSERT INTO group_members (group_id, user_id) 
  VALUES (v_group_id, p_user_id);
  
  RETURN v_group_id;
END;
$function$;

-- Update get_global_leaderboard function to be festival-aware
DROP FUNCTION IF EXISTS get_global_leaderboard(INT);

CREATE OR REPLACE FUNCTION get_global_leaderboard(
    p_winning_criteria_id INT,
    p_festival_id UUID DEFAULT NULL
)
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
            COUNT(DISTINCT a.date)::BIGINT AS days_attended,
            COALESCE(SUM(a.beer_count), 0)::BIGINT AS total_beers,
            CASE 
                WHEN COUNT(DISTINCT a.date) > 0 THEN 
                    ROUND(COALESCE(SUM(a.beer_count), 0)::NUMERIC / COUNT(DISTINCT a.date)::NUMERIC, 2)
                ELSE 0
            END AS avg_beers
        FROM attendances a
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
        COALESCE(ast.avg_beers, 0) AS avg_beers,
        COALESCE(gs.group_count, 0) AS group_count
    FROM profiles p
    LEFT JOIN attendance_stats ast ON p.id = ast.a_user_id
    LEFT JOIN group_stats gs ON p.id = gs.g_user_id
    WHERE 
        -- Only include users who have attendance data for the specified festival
        (p_festival_id IS NULL OR ast.a_user_id IS NOT NULL)
        AND (ast.days_attended > 0 OR ast.total_beers > 0)
    ORDER BY
        CASE 
            WHEN p_winning_criteria_id = 1 THEN COALESCE(ast.days_attended, 0)
            WHEN p_winning_criteria_id = 2 THEN COALESCE(ast.total_beers, 0) 
            WHEN p_winning_criteria_id = 3 THEN COALESCE(ast.avg_beers, 0)
            ELSE COALESCE(ast.total_beers, 0)
        END DESC;
END;
$$ LANGUAGE plpgsql;

-- Update the group leaderboard function to be festival-aware as well
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
    LEFT JOIN attendances a ON p.id = a.user_id AND a.festival_id = g.festival_id
    WHERE gm.group_id = p_group_id
    GROUP BY p.id, p.username, p.full_name, p.avatar_url
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