-- Fix the tent visit cache invalidation trigger function
-- The original function was trying to access NEW.attendance_id which doesn't exist in tent_visits table
CREATE OR REPLACE FUNCTION trigger_tent_visit_cache_invalidation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_festival_id UUID;
BEGIN
  -- Get user_id and festival_id directly from the tent_visits record
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  v_festival_id := COALESCE(NEW.festival_id, OLD.festival_id);

  -- Invalidate cache for this user and festival
  IF v_user_id IS NOT NULL AND v_festival_id IS NOT NULL THEN
    PERFORM invalidate_wrapped_cache(v_user_id, v_festival_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
