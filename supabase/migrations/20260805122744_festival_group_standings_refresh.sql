-- Materialises final group standings for one festival.
-- Past festivals are immutable, so this is computed once when a festival ends
-- and refreshed nightly only for the active one.
--
-- Only members with real activity (total_beers > 0 OR days_attended > 0) are
-- ranked. get_group_leaderboard LEFT JOINs attendances/consumptions, so an
-- inactive member still appears with total_beers=0, days_attended=0, and
-- row_number() would still assign someone rank 1 (whoever wins the user_id
-- tiebreak) -- the moment a group is created in an active festival and the
-- nightly cron runs, one member would unlock group_wins/podium_finishes
-- before anyone had done anything. Excluding zero-activity members changes
-- what member_count means: it now counts ACTIVE members ranked in this
-- snapshot, not raw group membership. A 5-member group with 1 active member
-- now stores member_count=1, correctly denying group_wins/podium_finishes
-- (which require member_count >= 2) rather than crediting a win nobody
-- actually competed for. max(rank) = member_count still holds; nothing else
-- in the repo reads this column.
--
-- member_count itself is derived from the same get_group_leaderboard
-- snapshot as the ranks (count(*) OVER () over its result), not a separate
-- cursor query taken beforehand -- two reads under READ COMMITTED can drift
-- apart if a member joins/leaves between them, corrupting the downstream
-- member_count >= 2 filter.
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
    WHERE lb.total_beers > 0 OR lb.days_attended > 0
    ON CONFLICT (festival_id, group_id, user_id) DO NOTHING;
  END LOOP;

  SELECT count(*) INTO v_rows_written
  FROM festival_group_standings WHERE festival_id = p_festival_id;

  RETURN v_rows_written;
END;
$$;

COMMENT ON FUNCTION public.refresh_festival_group_standings(uuid) IS
  'Recomputes final group standings for a festival. Safe to re-run; deletes and rebuilds. Ranks by each group''s own winning_criteria_id. Only members with real activity (total_beers > 0 OR days_attended > 0) are ranked, so member_count reflects active members ranked in this snapshot, not raw group membership.';

REVOKE EXECUTE ON FUNCTION public.refresh_festival_group_standings(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_festival_group_standings(uuid) TO service_role;
