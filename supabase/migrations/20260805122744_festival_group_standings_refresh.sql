-- Materialises final group standings for one festival.
-- Past festivals are immutable, so this is computed once when a festival ends
-- and refreshed nightly only for the active one.
CREATE OR REPLACE FUNCTION public.refresh_festival_group_standings(
  p_festival_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group record;
  v_rows_written integer := 0;
BEGIN
  DELETE FROM festival_group_standings WHERE festival_id = p_festival_id;

  FOR v_group IN
    SELECT g.id, g.winning_criteria_id,
           (SELECT count(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
    FROM groups g
    WHERE g.festival_id = p_festival_id
  LOOP
    -- Rank by the group's OWN winning criteria, mirroring the ordering inside
    -- get_group_leaderboard. Ranking everyone by total_beers regardless of
    -- criteria would credit the wrong member with winning the group.
    INSERT INTO festival_group_standings
      (festival_id, group_id, user_id, rank, member_count, criteria_id)
    SELECT
      p_festival_id,
      v_group.id,
      lb.user_id,
      row_number() OVER (
        ORDER BY
          CASE v_group.winning_criteria_id
            WHEN 1 THEN lb.days_attended::numeric
            WHEN 2 THEN lb.total_beers
            WHEN 3 THEN lb.avg_beers
            ELSE lb.total_beers
          END DESC,
          lb.total_beers DESC,
          lb.user_id
      ),
      v_group.member_count,
      v_group.winning_criteria_id
    FROM get_group_leaderboard(v_group.id, v_group.winning_criteria_id) lb
    ON CONFLICT (festival_id, group_id, user_id) DO NOTHING;
  END LOOP;

  SELECT count(*) INTO v_rows_written
  FROM festival_group_standings WHERE festival_id = p_festival_id;

  RETURN v_rows_written;
END;
$$;

COMMENT ON FUNCTION public.refresh_festival_group_standings(uuid) IS
  'Recomputes final group standings for a festival. Safe to re-run; deletes and rebuilds. Ranks by each group''s own winning_criteria_id.';

REVOKE EXECUTE ON FUNCTION public.refresh_festival_group_standings(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_festival_group_standings(uuid) TO service_role;
