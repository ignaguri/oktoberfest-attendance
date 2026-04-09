-- Add Fruehlingsfest 2026 (60th anniversary edition)
-- Dates: April 17 - May 10, 2026 (extended to 3 weeks)
-- Two large beer tents: Festhalle Bayernland (Augustiner) and Hippodrom (Spaten)

-- Step 1: Insert new tents (Fruehlingsfest-specific, not shared with Oktoberfest)
INSERT INTO tents (id, name, category) VALUES
  ('b0000000-0000-4000-b000-000000000001', 'Festhalle Bayernland', 'large'),
  ('b0000000-0000-4000-b000-000000000002', 'Hippodrom', 'large')
ON CONFLICT (id) DO NOTHING;

-- Step 2: Insert the festival
INSERT INTO festivals (
  name, short_name, festival_type, location,
  start_date, end_date, map_url,
  is_active, status, description,
  beer_cost, default_beer_price_cents,
  latitude, longitude
) VALUES (
  'Frühlingsfest 2026',
  'fruehlingsfest-2026',
  'fruehlingsfest',
  'Munich, Germany',
  '2026-04-17',
  '2026-05-10',
  'https://www.muenchen.de/veranstaltungen/feste-festivals/fruehlingsfest-2026-theresienwiese',
  false,
  'upcoming',
  'The 60th Frühlingsfest on the Theresienwiese — extended to three weeks for the anniversary',
  13.50,
  1350,
  48.1314,
  11.5498
);

-- Step 3: Link tents to festival with tent-specific beer prices
INSERT INTO festival_tents (festival_id, tent_id, beer_price, beer_price_cents)
VALUES
  (
    (SELECT id FROM festivals WHERE short_name = 'fruehlingsfest-2026'),
    'b0000000-0000-4000-b000-000000000001',
    13.50, 1350
  ),
  (
    (SELECT id FROM festivals WHERE short_name = 'fruehlingsfest-2026'),
    'b0000000-0000-4000-b000-000000000002',
    14.50, 1450
  );

-- Step 4: Create festival-level drink_type_prices (base: EUR 13.50)
DO $$
DECLARE
  v_festival_id uuid;
  v_base_price integer := 1350;
BEGIN
  SELECT id INTO v_festival_id FROM festivals WHERE short_name = 'fruehlingsfest-2026';

  INSERT INTO drink_type_prices (festival_id, drink_type, price_cents) VALUES
    (v_festival_id, 'beer', v_base_price),
    (v_festival_id, 'radler', v_base_price),
    (v_festival_id, 'alcohol_free', ROUND(v_base_price * 0.90)::integer),
    (v_festival_id, 'wine', ROUND(v_base_price * 0.85)::integer),
    (v_festival_id, 'soft_drink', ROUND(v_base_price * 0.40)::integer),
    (v_festival_id, 'other', v_base_price);
END $$;

-- Step 5: Create tent-level beer price override for Hippodrom (EUR 14.50 vs default EUR 13.50)
INSERT INTO drink_type_prices (festival_tent_id, drink_type, price_cents)
VALUES (
  (SELECT ft.id FROM festival_tents ft
   WHERE ft.tent_id = 'b0000000-0000-4000-b000-000000000002'
     AND ft.festival_id = (SELECT id FROM festivals WHERE short_name = 'fruehlingsfest-2026')),
  'beer',
  1450
);
