-- Recovered from the remote migration history on 2026-09-04. Dachauer Volksfest 2026 was applied
-- straight to prod under this timestamp, while PR #278 committed the identical SQL as
-- 20260814140000_add_dachauer_volksfest_2026.sql. That left prod holding a version the repo did not
-- have and the repo holding one prod had never run, so `supabase db push` refused to
-- run at all. This file is the version that actually executed; the PR #278 copy was
-- deleted, since re-running it would only collide with festivals_short_name_key.
--
-- Add Dachauer Volksfest 2026 (98th edition) as the active current festival.
-- Dates: 8-17 August 2026 (ten days), Ludwig-Thoma-Wiese, Dachau.
--
-- Data sourced by web research on 2026-08-14 (see PR/commit description for source links);
-- unlike 20260804121948_add_oktoberfest_2026.sql this has NO OpenStreetMap per-tent
-- coordinates and NO confirmed price for one tent (Festzelt Naumanns) or for any
-- non-beer drink type. Those gaps are called out below and should be verified against
-- the official program (https://www.dachau.de/dachauer-volksfest/) before this is treated
-- as final.
--
-- festival_type_enum has no 'dachauer_volksfest' / generic "Volksfest" value
-- ('oktoberfest' | 'starkbierfest' | 'fruehlingsfest' | 'other'), so this uses 'other'.
BEGIN;

-- Step 1: Only one festival may be active (idx_festivals_single_active is a unique partial
-- index), so clear the current holder before inserting. Oktoberfest 2026 (starts 2026-09-19)
-- is currently marked active despite not having started yet.
UPDATE festivals SET is_active = false WHERE is_active = true;

-- Step 2: The five 2026 tents/gastro operators. All five share one venue-level coordinate
-- (Ludwig-Thoma-Wiese) rather than per-tent OSM positions, since no per-tent source was found.
-- Categorized 'large' vs 'small' relative to each other, not to Oktoberfest's tents.
INSERT INTO tents (id, name, category, latitude, longitude) VALUES
  ('d1000000-0000-4000-b000-000000000001', 'Großes Festzelt', 'large', 48.2592, 11.4369), -- Rettinger; Augustiner
  ('d1000000-0000-4000-b000-000000000002', 'Schweiger''s Schmankerlzelt', 'small', 48.2592, 11.4369), -- Hefele; Spaten; 24x30m
  ('d1000000-0000-4000-b000-000000000003', 'Partyzelt s''Ziegler', 'small', 48.2592, 11.4369), -- Schneider/Vötter; Spaten; 25x15m
  ('d1000000-0000-4000-b000-000000000004', 'Festzelt Naumanns', 'small', 48.2592, 11.4369), -- Naumann; Augustiner (Halbe)
  ('d1000000-0000-4000-b000-000000000005', 'Weißbiergarten', 'small', 48.2592, 11.4369) -- Fahrenschon family; Amperbräu festival Weißbier
ON CONFLICT (id) DO NOTHING;

-- Step 3: The festival itself. status 'active' matches the runtime value that
-- packages/shared/src/utils/festival-status.ts derives from the dates (today, 2026-08-14,
-- falls within 2026-08-08 to 2026-08-17). beer_cost/default_beer_price_cents use the Großes
-- Festzelt (main tent) price of EUR 10.40 as the festival-wide base, same convention as
-- Oktoberfest using its main-tent-range price.
INSERT INTO festivals (
  name, short_name, festival_type, location,
  start_date, end_date, map_url,
  is_active, status, description,
  beer_cost, default_beer_price_cents,
  latitude, longitude
) VALUES (
  'Dachauer Volksfest 2026',
  'dachauer-volksfest-2026',
  'other',
  'Ludwig-Thoma-Wiese, Dachau, Germany',
  '2026-08-08',
  '2026-08-17',
  'https://www.dachau.de/dachauer-volksfest/',
  true,
  'active',
  'The 98th Dachauer Volksfest on the Ludwig-Thoma-Wiese below Dachau''s old town, ten days from 8 to 17 August 2026 -- known as Munich''s traditional "prelude to the Wiesn"',
  10.40,
  1040,
  48.2592,
  11.4369
);

-- Step 4: Link the five tents with their published Maß prices. Festzelt Naumanns has no
-- confirmed 2026 price (only that it pours Augustiner by the Halbe) -- left with beer_price
-- NULL/NULL so it falls back to the festival default (1040) rather than a guessed value.
INSERT INTO festival_tents (festival_id, tent_id, beer_price, beer_price_cents)
SELECT
  (SELECT id FROM festivals WHERE short_name = 'dachauer-volksfest-2026'),
  v.tent_id,
  v.cents / 100.0,
  v.cents
FROM (VALUES
  ('d1000000-0000-4000-b000-000000000001'::uuid, 1040), -- Großes Festzelt (Augustiner)
  ('d1000000-0000-4000-b000-000000000002'::uuid, 980),  -- Schweiger's Schmankerlzelt (Spaten)
  ('d1000000-0000-4000-b000-000000000003'::uuid, 980),  -- Partyzelt s'Ziegler (Spaten)
  ('d1000000-0000-4000-b000-000000000005'::uuid, 1030)  -- Weißbiergarten (Amperbräu)
) AS v(tent_id, cents);

-- Festzelt Naumanns still needs a festival_tents row (with NULL prices) so it shows up as
-- linked to the festival at all -- it's simply excluded from the price VALUES list above.
INSERT INTO festival_tents (festival_id, tent_id, beer_price, beer_price_cents)
VALUES (
  (SELECT id FROM festivals WHERE short_name = 'dachauer-volksfest-2026'),
  'd1000000-0000-4000-b000-000000000004',
  NULL,
  NULL
);

-- Step 5: Festival-level drink prices from the 1040 base. Only the beer price (EUR 10.40) is
-- sourced; radler/alcohol_free/wine/soft_drink/other reuse the same ratios as
-- 20260804121948_add_oktoberfest_2026.sql / 20260409174404_add_fruehlingsfest_2026.sql as a
-- placeholder -- NOT independently confirmed for Dachau and should be corrected if real prices
-- are found.
DO $$
DECLARE
  v_festival_id uuid;
  v_base_price integer := 1040;
BEGIN
  SELECT id INTO v_festival_id FROM festivals WHERE short_name = 'dachauer-volksfest-2026';

  INSERT INTO drink_type_prices (festival_id, drink_type, price_cents) VALUES
    (v_festival_id, 'beer', v_base_price),
    (v_festival_id, 'radler', v_base_price),
    (v_festival_id, 'alcohol_free', ROUND(v_base_price * 0.90)::integer),
    (v_festival_id, 'wine', ROUND(v_base_price * 0.85)::integer),
    (v_festival_id, 'soft_drink', ROUND(v_base_price * 0.40)::integer),
    (v_festival_id, 'other', v_base_price);
END $$;

-- Step 6: Per-tent beer and radler overrides, only where the tent price differs from the base
-- and is actually known (excludes Festzelt Naumanns, which has no festival_tents price set).
INSERT INTO drink_type_prices (festival_tent_id, drink_type, price_cents)
SELECT ft.id, d.drink_type, ft.beer_price_cents
FROM festival_tents ft
CROSS JOIN (VALUES ('beer'::drink_type), ('radler'::drink_type)) AS d(drink_type)
WHERE ft.festival_id = (SELECT id FROM festivals WHERE short_name = 'dachauer-volksfest-2026')
  AND ft.beer_price_cents IS NOT NULL
  AND ft.beer_price_cents <> 1040;

COMMIT;
