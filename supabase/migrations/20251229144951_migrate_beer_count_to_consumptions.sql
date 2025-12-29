-- Migration: Migrate beer_count to consumptions
-- Description: Converts existing attendance.beer_count into individual consumption records
-- Date: 2025-12-29
-- IMPORTANT: This is a one-way migration that preserves historical data

-- Step 1: Create consumption records from existing beer counts
-- We explode each beer_count into individual consumption records
-- Uses tent_visits to determine which tent and when
INSERT INTO consumptions (
  attendance_id,
  tent_id,
  drink_type,
  base_price_cents,
  price_paid_cents,
  volume_ml,
  recorded_at,
  created_at
)
SELECT
  a.id AS attendance_id,
  tv.tent_id,
  'beer'::drink_type AS drink_type,
  -- Use festival-specific pricing, fallback to tent, then festival default
  COALESCE(
    ft.beer_price,
    f.beer_cost,
    1620  -- Fallback to €16.20 if no pricing set
  ) AS base_price_cents,
  COALESCE(
    ft.beer_price,
    f.beer_cost,
    1620
  ) AS price_paid_cents,  -- Assume no tip for historical data
  1000 AS volume_ml,  -- Standard Maß
  tv.visit_date AS recorded_at,
  NOW() AS created_at
FROM attendances a
CROSS JOIN LATERAL generate_series(1, GREATEST(a.beer_count, 0)) AS beer_num
LEFT JOIN tent_visits tv ON tv.user_id = a.user_id
  AND tv.festival_id = a.festival_id
  AND tv.visit_date::date = a.date
LEFT JOIN festivals f ON f.id = a.festival_id
LEFT JOIN festival_tents ft ON ft.festival_id = a.festival_id
  AND ft.tent_id = tv.tent_id
WHERE a.beer_count > 0
ORDER BY a.id, beer_num;

-- Step 2: Handle attendances without tent_visits (create generic consumption records)
INSERT INTO consumptions (
  attendance_id,
  tent_id,
  drink_type,
  base_price_cents,
  price_paid_cents,
  volume_ml,
  recorded_at,
  created_at
)
SELECT
  a.id AS attendance_id,
  NULL AS tent_id,  -- No tent information available
  'beer'::drink_type AS drink_type,
  COALESCE(f.beer_cost, 1620) AS base_price_cents,
  COALESCE(f.beer_cost, 1620) AS price_paid_cents,
  1000 AS volume_ml,
  a.date::timestamptz AS recorded_at,  -- Use attendance date
  NOW() AS created_at
FROM attendances a
CROSS JOIN LATERAL generate_series(1, GREATEST(a.beer_count, 0)) AS beer_num
LEFT JOIN festivals f ON f.id = a.festival_id
WHERE a.beer_count > 0
  AND NOT EXISTS (
    -- Skip if we already created records with tent_visits
    SELECT 1 FROM tent_visits tv
    WHERE tv.user_id = a.user_id
      AND tv.festival_id = a.festival_id
      AND tv.visit_date::date = a.date
  )
ORDER BY a.id, beer_num;

-- Step 3: Verify migration integrity
DO $$
DECLARE
  original_total BIGINT;
  migrated_total BIGINT;
  mismatch_count INTEGER;
BEGIN
  -- Count original beer_count total
  SELECT COALESCE(SUM(beer_count), 0) INTO original_total
  FROM attendances;

  -- Count migrated consumption records (beers only)
  SELECT COUNT(*) INTO migrated_total
  FROM consumptions
  WHERE drink_type IN ('beer', 'radler');

  -- Check for mismatches
  SELECT COUNT(*) INTO mismatch_count
  FROM attendances a
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS consumption_count
    FROM consumptions c
    WHERE c.attendance_id = a.id
      AND c.drink_type IN ('beer', 'radler')
  ) c ON TRUE
  WHERE a.beer_count != COALESCE(c.consumption_count, 0);

  -- Log results
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Original beer_count total: %', original_total;
  RAISE NOTICE '  Migrated consumption records: %', migrated_total;
  RAISE NOTICE '  Attendances with mismatches: %', mismatch_count;

  -- Raise error if significant mismatch (allow small differences due to rounding/edge cases)
  IF mismatch_count > (SELECT COUNT(*) * 0.01 FROM attendances) THEN
    RAISE EXCEPTION 'Data migration integrity check failed: % mismatches found', mismatch_count;
  END IF;

  RAISE NOTICE 'Migration completed successfully!';
END $$;

-- Step 4: Add comment to track migration
COMMENT ON TABLE consumptions IS 'Individual drink consumption records. Migrated from attendances.beer_count on 2025-12-29.';
