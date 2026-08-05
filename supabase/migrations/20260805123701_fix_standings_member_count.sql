-- Fixes a race in refresh_festival_group_standings(): member_count was captured
-- from a separate cursor-query snapshot (raw group_members) taken before the
-- ranked INSERT ... SELECT FROM get_group_leaderboard() statement, which
-- re-reads membership under its own snapshot (READ COMMITTED = one snapshot per
-- statement). A join/leave between the two reads left a stale member_count
-- written into every standings row for that group, breaking
-- max(rank) = member_count on real (non-seed) data and corrupting the
-- downstream achievements filter on member_count >= 2.
--
-- get_group_leaderboard INNER JOINs group_members, so it already returns
-- exactly one row per member. count(*) OVER () over its result is the member
-- count taken from the SAME snapshot as the ranks, so the two can no longer
-- drift apart.
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
    SELECT g.id, g.winning_criteria_id
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
      count(*) OVER (),
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
  'Recomputes final group standings for a festival. Safe to re-run; deletes and rebuilds. Ranks by each group''s own winning_criteria_id. member_count is derived from the same get_group_leaderboard snapshot as the ranks.';

REVOKE EXECUTE ON FUNCTION public.refresh_festival_group_standings(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_festival_group_standings(uuid) TO service_role;
