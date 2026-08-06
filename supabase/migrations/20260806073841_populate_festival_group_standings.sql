-- Materialises final group standings for every concluded festival.
--
-- get_achievement_metrics derives group_wins and podium_finishes from
-- festival_group_standings, scoped to festivals with end_date < CURRENT_DATE.
-- That table has never been populated, so without this every competitive
-- achievement would backfill to zero for every user.
--
-- refresh_festival_group_standings deletes and rebuilds per festival, so this
-- is safe to re-run.
DO $$
DECLARE
  v_festival    record;
  v_rows        integer;
  v_total_rows  integer := 0;
  v_festivals   integer := 0;
BEGIN
  FOR v_festival IN
    SELECT id, name FROM public.festivals
    WHERE end_date < CURRENT_DATE
    ORDER BY start_date
  LOOP
    SELECT public.refresh_festival_group_standings(v_festival.id) INTO v_rows;
    v_total_rows := v_total_rows + v_rows;
    v_festivals  := v_festivals + 1;
    RAISE NOTICE 'Standings for %: % rows', v_festival.name, v_rows;
  END LOOP;

  RAISE NOTICE 'Refreshed % concluded festivals, % standings rows total',
    v_festivals, v_total_rows;
END $$;
