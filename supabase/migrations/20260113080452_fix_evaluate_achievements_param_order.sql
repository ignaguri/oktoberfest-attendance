-- Fix parameter order in evaluate_user_achievements function
-- The check_achievement_conditions function expects (p_user_id, p_achievement_id, p_festival_id)
-- but evaluate_user_achievements was calling it with (p_user_id, p_festival_id, achievement_rec.id)
-- This caused achievements to never be properly evaluated and unlocked

CREATE OR REPLACE FUNCTION "public"."evaluate_user_achievements"("p_user_id" "uuid", "p_festival_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  achievement_rec achievements;
  unlocked boolean;
BEGIN
  -- Loop through all active achievements
  FOR achievement_rec IN
    SELECT * FROM achievements WHERE is_active = true
  LOOP
    -- Check if conditions are met and not already unlocked
    -- Fixed parameter order: (p_user_id, p_achievement_id, p_festival_id)
    IF check_achievement_conditions(p_user_id, achievement_rec.id, p_festival_id) THEN
      -- Try to unlock the achievement
      SELECT unlock_achievement(p_user_id, p_festival_id, achievement_rec.id) INTO unlocked;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION "public"."evaluate_user_achievements"("p_user_id" "uuid", "p_festival_id" "uuid") IS 'Evaluates all achievements for a user and unlocks eligible ones';
