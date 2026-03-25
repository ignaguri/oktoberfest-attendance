-- =============================================================================
-- Backfill: Create consumption records for Starkbierfest 2026 attendances
-- that have beer_count > 0 but no consumptions.
--
-- Usage:
--   1. Run the DRY RUN query first to preview affected rows
--   2. Then run the INSERT to backfill
--   3. Verify with the verification query at the bottom
-- =============================================================================

-- =====================
-- DRY RUN: Preview what will be backfilled
-- =====================
WITH starkbier_festival AS (
  SELECT id, beer_cost
  FROM festivals
  WHERE festival_type = 'starkbierfest'
    AND name ILIKE '%2026%'
  LIMIT 1
),
missing_attendances AS (
  SELECT
    a.id AS attendance_id,
    a.user_id,
    a.beer_count,
    a.date,
    a.created_at,
    sf.beer_cost
  FROM attendances a
  JOIN starkbier_festival sf ON a.festival_id = sf.id
  WHERE a.beer_count > 0
    AND NOT EXISTS (
      SELECT 1 FROM consumptions c WHERE c.attendance_id = a.id
    )
)
SELECT
  p.username,
  ma.date,
  ma.beer_count,
  ROUND(ma.beer_cost * 100)::int AS price_cents_per_beer,
  ma.attendance_id
FROM missing_attendances ma
JOIN profiles p ON p.id = ma.user_id
ORDER BY p.username, ma.date;


-- =====================
-- BACKFILL: Insert consumption records
-- Uncomment and run after verifying the dry run above
-- =====================

-- WITH starkbier_festival AS (
--   SELECT id, beer_cost
--   FROM festivals
--   WHERE festival_type = 'starkbierfest'
--     AND name ILIKE '%2026%'
--   LIMIT 1
-- ),
-- missing_attendances AS (
--   SELECT
--     a.id AS attendance_id,
--     a.user_id,
--     a.beer_count,
--     a.date,
--     a.created_at,
--     sf.beer_cost
--   FROM attendances a
--   JOIN starkbier_festival sf ON a.festival_id = sf.id
--   WHERE a.beer_count > 0
--     AND NOT EXISTS (
--       SELECT 1 FROM consumptions c WHERE c.attendance_id = a.id
--     )
-- )
-- INSERT INTO consumptions (
--   attendance_id,
--   drink_type,
--   base_price_cents,
--   price_paid_cents,
--   volume_ml,
--   recorded_at
-- )
-- SELECT
--   ma.attendance_id,
--   'beer'::drink_type,
--   ROUND(ma.beer_cost * 100)::integer,
--   ROUND(ma.beer_cost * 100)::integer,
--   1000,
--   ma.created_at + (gs.n - 1) * INTERVAL '1 minute'
-- FROM missing_attendances ma
-- CROSS JOIN LATERAL generate_series(1, ma.beer_count) AS gs(n);


-- =====================
-- VERIFY: Check backfilled data matches original beer_count
-- =====================

-- WITH starkbier_festival AS (
--   SELECT id FROM festivals
--   WHERE festival_type = 'starkbierfest' AND name ILIKE '%2026%'
--   LIMIT 1
-- )
-- SELECT
--   p.username,
--   a.date,
--   a.beer_count AS original_beer_count,
--   COUNT(c.id) AS consumption_count,
--   CASE WHEN a.beer_count = COUNT(c.id) THEN 'OK' ELSE 'MISMATCH' END AS status
-- FROM attendances a
-- JOIN starkbier_festival sf ON a.festival_id = sf.id
-- JOIN profiles p ON p.id = a.user_id
-- LEFT JOIN consumptions c ON c.attendance_id = a.id AND c.drink_type = 'beer'
-- WHERE a.beer_count > 0
-- GROUP BY p.username, a.date, a.beer_count
-- ORDER BY p.username, a.date;
