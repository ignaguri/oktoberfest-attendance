-- Consumption and attendance changes invalidate the whole festival's Wrapped.
--
-- Every attendee's Wrapped carries festival-wide numbers: vs_festival_avg,
-- global leaderboard positions and group rankings. Dropping only the owner's
-- row left everyone else's cached Wrapped stale, and the likeliest time for
-- that is right after the unlock, when people backfill last night's drinks.
-- Before the unlock nothing is cached, so these deletes are no-ops during the
-- festival itself.

CREATE OR REPLACE FUNCTION public.trigger_consumption_cache_invalidation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- OLD is NULL on INSERT and NEW is NULL on DELETE; an UPDATE that moves a
  -- drink to another attendance invalidates both festivals.
  DELETE FROM wrapped_data_cache
  WHERE festival_id IN (
    SELECT a.festival_id
    FROM attendances a
    WHERE a.id IN (OLD.attendance_id, NEW.attendance_id)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_wrapped_cache_invalidation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Attendance days feed the days_attended leaderboard, so every attendee's
  -- position can move. Both festivals when an UPDATE moves the row.
  DELETE FROM wrapped_data_cache
  WHERE festival_id IN (OLD.festival_id, NEW.festival_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trigger_consumption_cache_invalidation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_wrapped_cache_invalidation() FROM PUBLIC, anon, authenticated;
