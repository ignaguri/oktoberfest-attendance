-- Update views to include spending breakdown (base cost, tips)

-- Drop dependent views first (order matters due to dependencies)
DROP VIEW IF EXISTS public.user_festival_spending_stats;
DROP VIEW IF EXISTS public.user_festival_stats;
DROP VIEW IF EXISTS public.attendance_with_totals;

-- Recreate attendance_with_totals view with total_base_cents column
CREATE VIEW public.attendance_with_totals WITH (security_invoker='true') AS
SELECT
    a.id,
    a.user_id,
    a.festival_id,
    a.date,
    a.created_at,
    a.updated_at,
    COALESCE(c.drink_count, 0::bigint) AS drink_count,
    COALESCE(c.beer_count, a.beer_count::bigint, 0::bigint) AS beer_count,
    COALESCE(c.total_spent_cents, 0::bigint) AS total_spent_cents,
    COALESCE(c.total_base_cents, 0::bigint) AS total_base_cents,
    COALESCE(c.total_tip_cents, 0::bigint) AS total_tip_cents,
    COALESCE(c.avg_price_cents, 0) AS avg_price_cents
FROM attendances a
LEFT JOIN LATERAL (
    SELECT
        count(*) AS drink_count,
        count(*) FILTER (WHERE consumptions.drink_type = ANY (ARRAY['beer'::drink_type, 'radler'::drink_type])) AS beer_count,
        sum(consumptions.price_paid_cents) AS total_spent_cents,
        sum(consumptions.base_price_cents) AS total_base_cents,
        sum(consumptions.tip_cents) AS total_tip_cents,
        avg(consumptions.price_paid_cents)::integer AS avg_price_cents
    FROM consumptions
    WHERE consumptions.attendance_id = a.id
    HAVING count(*) > 0
) c ON true;

-- Recreate user_festival_stats view with spending breakdown
CREATE VIEW public.user_festival_stats AS
SELECT
    a.user_id,
    a.festival_id,
    COUNT(DISTINCT a.date) AS days_attended,
    COALESCE(SUM(awt.beer_count), 0)::bigint AS total_beers,
    CASE
        WHEN COUNT(DISTINCT a.date) > 0
        THEN ROUND(COALESCE(SUM(awt.beer_count), 0)::numeric / COUNT(DISTINCT a.date), 1)
        ELSE 0
    END AS avg_beers,
    COALESCE(SUM(awt.total_spent_cents), 0)::bigint AS total_spent_cents,
    COALESCE(SUM(awt.total_base_cents), 0)::bigint AS total_base_cents,
    COALESCE(SUM(awt.total_tip_cents), 0)::bigint AS total_tips_cents
FROM attendances a
LEFT JOIN attendance_with_totals awt ON a.id = awt.id
GROUP BY a.user_id, a.festival_id;

-- Create user_festival_spending_stats view for detailed spending analysis
CREATE VIEW public.user_festival_spending_stats AS
SELECT
    a.user_id,
    a.festival_id,
    COUNT(DISTINCT a.date) AS days_attended,
    COALESCE(SUM(awt.drink_count), 0)::bigint AS total_drinks,
    COALESCE(SUM(awt.beer_count), 0)::bigint AS total_beers,
    COALESCE(SUM(awt.total_spent_cents), 0)::bigint AS total_spent_cents,
    COALESCE(SUM(awt.total_base_cents), 0)::bigint AS total_base_cents,
    COALESCE(SUM(awt.total_tip_cents), 0)::bigint AS total_tips_cents,
    CASE
        WHEN COALESCE(SUM(awt.drink_count), 0) > 0
        THEN ROUND(COALESCE(SUM(awt.total_tip_cents), 0)::numeric / SUM(awt.drink_count), 0)::integer
        ELSE 0
    END AS avg_tip_per_drink_cents,
    CASE
        WHEN COUNT(DISTINCT a.date) > 0
        THEN ROUND(COALESCE(SUM(awt.total_spent_cents), 0)::numeric / COUNT(DISTINCT a.date), 0)::integer
        ELSE 0
    END AS avg_spent_per_day_cents
FROM attendances a
LEFT JOIN attendance_with_totals awt ON a.id = awt.id
GROUP BY a.user_id, a.festival_id;

-- Grant access to authenticated users
GRANT SELECT ON public.user_festival_spending_stats TO authenticated;

COMMENT ON VIEW public.user_festival_spending_stats IS 'Detailed spending statistics per user per festival, including tips breakdown';
