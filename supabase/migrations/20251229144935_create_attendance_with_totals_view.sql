-- Migration: Create attendance_with_totals view
-- Description: Materialized view computing totals from consumptions table
-- Date: 2025-12-29

-- Create view that joins attendances with computed consumption totals
-- Note: This view computes drink/beer counts from consumptions table
-- The original attendances.beer_count column is preserved for backward compatibility
CREATE OR REPLACE VIEW attendance_with_totals AS
SELECT
  a.id,
  a.user_id,
  a.festival_id,
  a.date,
  a.created_at,
  a.updated_at,
  -- Computed fields from consumptions
  COALESCE(c.drink_count, 0) AS drink_count,
  COALESCE(c.beer_count, 0) AS beer_count,
  COALESCE(c.total_spent_cents, 0) AS total_spent_cents,
  COALESCE(c.total_tip_cents, 0) AS total_tip_cents,
  COALESCE(c.avg_price_cents, 0) AS avg_price_cents
FROM attendances a
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS drink_count,
    COUNT(*) FILTER (WHERE drink_type IN ('beer', 'radler')) AS beer_count,
    SUM(price_paid_cents) AS total_spent_cents,
    SUM(tip_cents) AS total_tip_cents,
    AVG(price_paid_cents)::INTEGER AS avg_price_cents
  FROM consumptions
  WHERE attendance_id = a.id
) c ON TRUE;

-- Add comment for documentation
COMMENT ON VIEW attendance_with_totals IS 'Attendances with computed totals from consumptions. Replaces direct beer_count column.';

-- Grant permissions (same as attendances table)
-- Note: RLS is inherited from the attendances table
GRANT SELECT ON attendance_with_totals TO authenticated;
GRANT SELECT ON attendance_with_totals TO anon;
