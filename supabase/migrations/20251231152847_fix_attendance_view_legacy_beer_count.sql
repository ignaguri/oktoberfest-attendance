-- Update attendance_with_totals view to fall back to legacy beer_count when no consumptions exist
-- This maintains backward compatibility with the old system that stored beer_count directly
-- while allowing the new consumption-based system to take precedence when data exists

CREATE OR REPLACE VIEW attendance_with_totals AS
SELECT
    a.id,
    a.user_id,
    a.festival_id,
    a.date,
    a.created_at,
    a.updated_at,
    COALESCE(c.drink_count, 0::bigint) AS drink_count,
    -- Use consumptions beer_count if available, otherwise fall back to legacy beer_count
    COALESCE(c.beer_count, a.beer_count::bigint, 0::bigint) AS beer_count,
    COALESCE(c.total_spent_cents, 0::bigint) AS total_spent_cents,
    COALESCE(c.total_tip_cents, 0::bigint) AS total_tip_cents,
    COALESCE(c.avg_price_cents, 0) AS avg_price_cents
FROM attendances a
LEFT JOIN LATERAL (
    SELECT
        count(*) AS drink_count,
        count(*) FILTER (WHERE consumptions.drink_type = ANY (ARRAY['beer'::drink_type, 'radler'::drink_type])) AS beer_count,
        sum(consumptions.price_paid_cents) AS total_spent_cents,
        sum(consumptions.tip_cents) AS total_tip_cents,
        avg(consumptions.price_paid_cents)::integer AS avg_price_cents
    FROM consumptions
    WHERE consumptions.attendance_id = a.id
    HAVING count(*) > 0  -- Only return aggregates if there are consumptions
) c ON true;
