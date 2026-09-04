-- Recovered from the remote migration history on 2026-09-04. Rosenheimer Herbstfest 2026 was applied
-- straight to prod under this timestamp, while PR #278 committed the identical SQL as
-- 20260814141500_add_rosenheimer_herbstfest_2026.sql. That left prod holding a version the repo did not
-- have and the repo holding one prod had never run, so `supabase db push` refused to
-- run at all. This file is the version that actually executed; the PR #278 copy was
-- deleted, since re-running it would only collide with festivals_short_name_key.
--
-- Add Rosenheimer Herbstfest 2026 as an upcoming (not active) festival.
-- Dates: 29 August - 13 September 2026 (16 days), Loretowiese, Rosenheim.
BEGIN;

-- Step 1: The four 2026 tents/gastro operators. All four share one venue-level coordinate
-- (Loretowiese) rather than per-tent OSM positions, since no per-tent source was found.
-- Categorized 'large' for the two flagship beer tents, 'small' for the two wine/Prosecco tents.
INSERT INTO tents (id, name, category, latitude, longitude) VALUES
  ('d2000000-0000-4000-b000-000000000001', 'Flötzinger-Festzelt', 'large', 47.8599, 12.1255), -- Festwirt Andreas Schmidt; Flötzinger Wiesn-Märzen
  ('d2000000-0000-4000-b000-000000000002', 'AuerBräu-Festhalle', 'large', 47.8599, 12.1255), -- Familie Heinrichsberger; AuerBräu Herbstfest-Märzen
  ('d2000000-0000-4000-b000-000000000003', 'Tatzlwurm', 'small', 47.8599, 12.1255), -- Festwirt Karl Kiesl; wine/Prosecco/game, beer garden since 2010
  ('d2000000-0000-4000-b000-000000000004', 'Proseccostadl', 'small', 47.8599, 12.1255) -- wine/Prosecco/Champagne
ON CONFLICT (id) DO NOTHING;

-- Step 2: The festival itself. status 'upcoming', is_active stays false.
INSERT INTO festivals (
  name, short_name, festival_type, location,
  start_date, end_date, map_url,
  is_active, status, description,
  beer_cost, default_beer_price_cents,
  latitude, longitude
) VALUES (
  'Rosenheimer Herbstfest 2026',
  'rosenheimer-herbstfest-2026',
  'other',
  'Loretowiese, Rosenheim, Germany',
  '2026-08-29',
  '2026-09-13',
  'https://www.herbstfest-rosenheim.de/',
  false,
  'upcoming',
  'The Rosenheimer Herbstfest on the Loretowiese, 16 days from 29 August to 13 September 2026 -- the largest folk festival in southeastern Upper Bavaria, drawing over a million visitors',
  13.50,
  1350,
  47.8599,
  12.1255
);

-- Step 3: Link the two flagship tents with their published Maß prices. Tatzlwurm and
-- Proseccostadl have no confirmed beer price -- linked with beer_price NULL/NULL so they fall
-- back to the festival default (1350) rather than a guessed value.
INSERT INTO festival_tents (festival_id, tent_id, beer_price, beer_price_cents)
SELECT
  (SELECT id FROM festivals WHERE short_name = 'rosenheimer-herbstfest-2026'),
  v.tent_id,
  v.cents / 100.0,
  v.cents
FROM (VALUES
  ('d2000000-0000-4000-b000-000000000001'::uuid, 1360), -- Flötzinger-Festzelt
  ('d2000000-0000-4000-b000-000000000002'::uuid, 1340)  -- AuerBräu-Festhalle
) AS v(tent_id, cents);

INSERT INTO festival_tents (festival_id, tent_id, beer_price, beer_price_cents)
VALUES
  ((SELECT id FROM festivals WHERE short_name = 'rosenheimer-herbstfest-2026'), 'd2000000-0000-4000-b000-000000000003', NULL, NULL), -- Tatzlwurm
  ((SELECT id FROM festivals WHERE short_name = 'rosenheimer-herbstfest-2026'), 'd2000000-0000-4000-b000-000000000004', NULL, NULL); -- Proseccostadl

-- Step 4: Festival-level drink prices from the 1350 base.
DO $$
DECLARE
  v_festival_id uuid;
  v_base_price integer := 1350;
BEGIN
  SELECT id INTO v_festival_id FROM festivals WHERE short_name = 'rosenheimer-herbstfest-2026';

  INSERT INTO drink_type_prices (festival_id, drink_type, price_cents) VALUES
    (v_festival_id, 'beer', v_base_price),
    (v_festival_id, 'radler', v_base_price),
    (v_festival_id, 'alcohol_free', ROUND(v_base_price * 0.90)::integer),
    (v_festival_id, 'wine', ROUND(v_base_price * 0.85)::integer),
    (v_festival_id, 'soft_drink', ROUND(v_base_price * 0.40)::integer),
    (v_festival_id, 'other', v_base_price);
END $$;

-- Step 5: Per-tent beer and radler overrides, only where the tent price differs from the base
-- and is actually known.
INSERT INTO drink_type_prices (festival_tent_id, drink_type, price_cents)
SELECT ft.id, d.drink_type, ft.beer_price_cents
FROM festival_tents ft
CROSS JOIN (VALUES ('beer'::drink_type), ('radler'::drink_type)) AS d(drink_type)
WHERE ft.festival_id = (SELECT id FROM festivals WHERE short_name = 'rosenheimer-herbstfest-2026')
  AND ft.beer_price_cents IS NOT NULL
  AND ft.beer_price_cents <> 1350;

COMMIT;
