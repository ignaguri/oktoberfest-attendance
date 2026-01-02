-- Fix: Update get_user_achievements to use evaluate_achievement_progress
-- The calculate_achievement_progress function was changed to return boolean in a previous migration.
-- get_user_achievements needs to use evaluate_achievement_progress which returns jsonb.

CREATE OR REPLACE FUNCTION get_user_achievements(
  p_user_id uuid,
  p_festival_id uuid
) RETURNS TABLE(
  achievement_id uuid,
  name text,
  description text,
  category achievement_category_enum,
  icon text,
  points integer,
  rarity achievement_rarity_enum,
  is_unlocked boolean,
  unlocked_at timestamptz,
  current_progress jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.name,
    a.description,
    a.category,
    a.icon,
    a.points,
    a.rarity,
    ua.id IS NOT NULL as is_unlocked,
    ua.unlocked_at,
    evaluate_achievement_progress(p_user_id, a.id, p_festival_id) as current_progress
  FROM achievements a
  LEFT JOIN user_achievements ua ON (
    ua.achievement_id = a.id
    AND ua.user_id = p_user_id
    AND ua.festival_id = p_festival_id
  )
  WHERE a.is_active = true
  ORDER BY
    CASE WHEN ua.id IS NOT NULL THEN 0 ELSE 1 END, -- Unlocked first
    a.category,
    a.points,
    a.name;
END;
$$;
