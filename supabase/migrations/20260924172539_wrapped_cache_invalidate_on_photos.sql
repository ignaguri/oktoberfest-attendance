-- Wrapped counts a user's photos and shows up to 20 of them, but nothing
-- invalidated the cache on a beer_pictures write, so a deleted photo stayed in
-- Wrapped as a broken image. Same shape as the tent_visits trigger; the festival
-- comes from the photo's attendance. When the attendance itself is deleted the
-- lookup finds nothing, and the attendances trigger covers that case.

CREATE OR REPLACE FUNCTION public.trigger_beer_picture_cache_invalidation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_festival_id uuid;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  SELECT a.festival_id INTO v_festival_id
  FROM attendances a
  WHERE a.id = COALESCE(NEW.attendance_id, OLD.attendance_id);

  IF v_user_id IS NOT NULL AND v_festival_id IS NOT NULL THEN
    PERFORM invalidate_wrapped_cache(v_user_id, v_festival_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_beer_pictures_wrapped_cache_invalidation ON public.beer_pictures;

CREATE TRIGGER tr_beer_pictures_wrapped_cache_invalidation
AFTER INSERT OR DELETE ON public.beer_pictures
FOR EACH ROW EXECUTE FUNCTION public.trigger_beer_picture_cache_invalidation();
