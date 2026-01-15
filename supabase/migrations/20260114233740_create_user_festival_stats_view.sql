-- Create a view for user festival statistics
-- This view aggregates attendance data to show days attended, total beers, and avg beers per day
-- It's designed for public profile viewing with appropriate RLS

CREATE OR REPLACE VIEW public.user_festival_stats AS
SELECT
    a.user_id,
    a.festival_id,
    COUNT(DISTINCT a.date) AS days_attended,
    COALESCE(SUM(awt.beer_count), 0)::bigint AS total_beers,
    CASE
        WHEN COUNT(DISTINCT a.date) > 0
        THEN ROUND(COALESCE(SUM(awt.beer_count), 0)::numeric / COUNT(DISTINCT a.date), 1)
        ELSE 0
    END AS avg_beers
FROM attendances a
LEFT JOIN attendance_with_totals awt ON a.id = awt.id
GROUP BY a.user_id, a.festival_id;

-- Grant access to authenticated users
GRANT SELECT ON public.user_festival_stats TO authenticated;

COMMENT ON VIEW public.user_festival_stats IS 'Aggregated user statistics per festival for public profile viewing';
