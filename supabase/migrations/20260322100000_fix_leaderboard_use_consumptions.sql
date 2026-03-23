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

-- =============================================================================
-- Fix activity_feed view: use consumptions table instead of attendances.beer_count
-- The friendship_security_fixes migration (20260318) reverted this to
-- attendances.beer_count which is deprecated and always 0.
-- =============================================================================

DROP VIEW IF EXISTS public.activity_feed;

CREATE VIEW public.activity_feed
WITH (security_invoker = true)
AS
WITH user_group_members AS (
  SELECT DISTINCT gm2.user_id,
    gm2.group_id,
    g.festival_id
  FROM group_members gm1
    JOIN group_members gm2 ON gm1.group_id = gm2.group_id
    JOIN groups g ON g.id = gm1.group_id
  WHERE gm1.user_id = auth.uid() AND gm2.user_id <> auth.uid()
),
user_friends AS (
  SELECT
    CASE
      WHEN f.requester_id = auth.uid() THEN f.addressee_id
      ELSE f.requester_id
    END AS user_id
  FROM friendships f
  WHERE f.status = 'accepted'
  AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
),
visible_users AS (
  SELECT DISTINCT user_id, festival_id FROM user_group_members
  UNION
  SELECT DISTINCT uf.user_id, a.festival_id
  FROM user_friends uf
  JOIN attendances a ON a.user_id = uf.user_id
  WHERE GREATEST(a.created_at, a.updated_at) > (now() - '48:00:00'::interval)
),
-- Aggregate consumptions by attendance and drink_type
recent_consumptions AS (
  SELECT
    a.user_id,
    a.festival_id,
    'beer_count_update'::activity_type_enum AS activity_type,
    jsonb_build_object(
      'drink_type', c.drink_type::text,
      'drink_count', COUNT(*)::int,
      'beer_count', COUNT(*)::int,
      'date', a.date,
      'attendance_id', a.id
    ) AS activity_data,
    MAX(c.recorded_at) AS activity_time,
    MIN(c.created_at) AS created_at,
    MAX(c.updated_at) AS updated_at
  FROM consumptions c
    JOIN attendances a ON a.id = c.attendance_id
    JOIN visible_users vu ON vu.user_id = a.user_id AND vu.festival_id = a.festival_id
  WHERE c.recorded_at > (now() - '48:00:00'::interval)
  GROUP BY a.user_id, a.festival_id, a.id, a.date, c.drink_type
),
recent_tent_visits AS (
  SELECT tv.user_id,
    tv.festival_id,
    'tent_checkin'::activity_type_enum AS activity_type,
    jsonb_build_object('tent_id', tv.tent_id, 'tent_name', t.name, 'visit_date', tv.visit_date) AS activity_data,
    tv.visit_date AS activity_time,
    tv.visit_date AS created_at,
    tv.visit_date AS updated_at
  FROM tent_visits tv
    JOIN tents t ON t.id = tv.tent_id
    JOIN visible_users vu ON vu.user_id = tv.user_id AND vu.festival_id = tv.festival_id
  WHERE tv.visit_date > (now() - '48:00:00'::interval)
),
recent_photos AS (
  SELECT bp.user_id,
    a.festival_id,
    'photo_upload'::activity_type_enum AS activity_type,
    jsonb_build_object('picture_url', bp.picture_url, 'attendance_id', bp.attendance_id, 'date', a.date) AS activity_data,
    bp.created_at AS activity_time,
    bp.created_at,
    bp.created_at AS updated_at
  FROM beer_pictures bp
    JOIN attendances a ON a.id = bp.attendance_id
    JOIN visible_users vu ON vu.user_id = bp.user_id AND vu.festival_id = a.festival_id
  WHERE bp.created_at > (now() - '48:00:00'::interval)
    AND bp.visibility = 'public'::photo_visibility_enum
),
recent_group_joins AS (
  SELECT gm.user_id,
    g.festival_id,
    'group_join'::activity_type_enum AS activity_type,
    jsonb_build_object('group_id', g.id, 'group_name', g.name) AS activity_data,
    gm.joined_at AS activity_time,
    gm.joined_at AS created_at,
    gm.joined_at AS updated_at
  FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    JOIN visible_users vu ON vu.user_id = gm.user_id AND vu.festival_id = g.festival_id
  WHERE gm.joined_at > (now() - '48:00:00'::interval)
),
recent_achievements AS (
  SELECT ua.user_id,
    ua.festival_id,
    'achievement_unlock'::activity_type_enum AS activity_type,
    jsonb_build_object('achievement_id', ua.achievement_id, 'achievement_name', ach.name, 'achievement_icon', ach.icon, 'rarity', ach.rarity) AS activity_data,
    ua.unlocked_at AS activity_time,
    ua.unlocked_at AS created_at,
    ua.unlocked_at AS updated_at
  FROM user_achievements ua
    JOIN achievements ach ON ach.id = ua.achievement_id
    JOIN visible_users vu ON vu.user_id = ua.user_id AND vu.festival_id = ua.festival_id
  WHERE ua.unlocked_at > (now() - '48:00:00'::interval)
),
all_activities AS (
  SELECT * FROM recent_consumptions
  UNION ALL
  SELECT * FROM recent_tent_visits
  UNION ALL
  SELECT * FROM recent_photos
  UNION ALL
  SELECT * FROM recent_group_joins
  UNION ALL
  SELECT * FROM recent_achievements
)
SELECT
  aa.user_id,
  aa.festival_id,
  aa.activity_type,
  aa.activity_data,
  aa.activity_time,
  p.username,
  p.full_name,
  p.avatar_url
FROM all_activities aa
  JOIN profiles p ON p.id = aa.user_id
ORDER BY aa.activity_time DESC;

GRANT SELECT ON public.activity_feed TO authenticated;
