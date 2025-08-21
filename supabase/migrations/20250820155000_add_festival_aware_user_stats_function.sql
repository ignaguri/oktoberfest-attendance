-- Create festival-aware user stats function that includes top_positions
CREATE OR REPLACE FUNCTION get_user_festival_stats_with_positions(
  p_user_id UUID,
  p_festival_id UUID
) RETURNS TABLE (
  top_positions JSONB,
  total_beers BIGINT,
  days_attended BIGINT
) AS $$
DECLARE
  user_total_beers BIGINT := 0;
  user_days_attended BIGINT := 0;
BEGIN
  -- Get user's total beers and days attended for the festival
  SELECT 
    COALESCE(SUM(a.beer_count), 0),
    COUNT(DISTINCT a.date)
  INTO 
    user_total_beers,
    user_days_attended
  FROM 
    attendances a
  WHERE 
    a.user_id = p_user_id
    AND a.festival_id = p_festival_id;

  -- Return the stats with top positions
  RETURN QUERY
  WITH ranked_leaderboard AS (
    SELECT 
      g.id AS group_id,
      g.name AS group_name,
      wc.name AS winning_criteria,
      CASE 
        WHEN wc.name = 'days_attended' THEN 
          ROW_NUMBER() OVER (
            PARTITION BY g.id 
            ORDER BY COUNT(DISTINCT a.date) DESC, p.username ASC
          )
        WHEN wc.name = 'total_beers' THEN 
          ROW_NUMBER() OVER (
            PARTITION BY g.id 
            ORDER BY COALESCE(SUM(a.beer_count), 0) DESC, p.username ASC
          )
        WHEN wc.name = 'avg_beers' THEN 
          ROW_NUMBER() OVER (
            PARTITION BY g.id 
            ORDER BY COALESCE(AVG(a.beer_count), 0) DESC, p.username ASC
          )
        ELSE 1
      END AS user_rank
    FROM 
      groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN attendances a ON gm.user_id = a.user_id AND a.festival_id = p_festival_id
      LEFT JOIN profiles p ON gm.user_id = p.id
      LEFT JOIN winning_criteria wc ON g.winning_criteria_id = wc.id
    WHERE 
      g.festival_id = p_festival_id
      AND gm.user_id = p_user_id  -- Only consider groups where the user is a member
    GROUP BY 
      g.id, g.name, wc.name, p.username  -- Include p.username in GROUP BY
  )
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'group_id', group_id, 
          'group_name', group_name
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
$$ LANGUAGE plpgsql;