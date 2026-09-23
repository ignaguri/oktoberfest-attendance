-- Festival totals for one user, readable by anyone signed in.
--
-- The profile page read these from user_festival_stats. That view is not
-- security_invoker, so it sees every attendance, but it takes the drink counts
-- from attendance_with_totals, which is, so RLS on consumptions applies there.
-- A viewer who is neither a friend nor a group mate got the right number of
-- days next to zero drinks.
--
-- get_global_leaderboard already shows these three numbers for every user to
-- every signed-in user, so this exposes nothing new. It deliberately returns
-- only them: the view also carries spending, which stays private.
--
-- The math matches user_festival_stats so a friend, who reads the history
-- rows from the view, sees the same totals as this returns.

CREATE OR REPLACE FUNCTION public.get_profile_festival_stats(p_user_id uuid, p_festival_id uuid)
RETURNS TABLE (days_attended bigint, total_beers bigint, avg_beers numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT
        COUNT(DISTINCT a.date) AS days_attended,
        COALESCE(SUM(COALESCE(c.beer_count, a.beer_count::bigint, 0)), 0)::bigint AS total_beers,
        CASE
            WHEN COUNT(DISTINCT a.date) > 0
            THEN ROUND(COALESCE(SUM(COALESCE(c.beer_count, a.beer_count::bigint, 0)), 0)::numeric / COUNT(DISTINCT a.date), 1)
            ELSE 0
        END AS avg_beers
    FROM attendances a
    LEFT JOIN LATERAL (
        SELECT count(*) FILTER (WHERE consumptions.drink_type IN ('beer', 'radler')) AS beer_count
        FROM consumptions
        WHERE consumptions.attendance_id = a.id
        HAVING count(*) > 0
    ) c ON true
    WHERE a.user_id = p_user_id
      AND a.festival_id = p_festival_id
    HAVING COUNT(*) > 0;
$$;

-- Supabase's default privileges grant new functions to anon and authenticated
-- directly, so revoking from PUBLIC alone would leave anon able to call this.
REVOKE EXECUTE ON FUNCTION public.get_profile_festival_stats(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_festival_stats(uuid, uuid) TO authenticated, service_role;
