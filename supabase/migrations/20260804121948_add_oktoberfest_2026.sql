-- Add Oktoberfest 2026 (191st Wiesn) and replace fabricated tent coordinates.
-- Dates: 19 September to 4 October 2026 (16 days).
--
-- Coordinates come from OpenStreetMap via the Overpass API (ODbL, snapshot 2026-08-04).
-- They replace the placeholder coordinates added in
-- 20260126000000_postgis_tent_coordinates.sql, which that migration's own comment called
-- "approximate": they were laid out along a synthetic diagonal and were wrong by up to ~900 m.
-- The existing tent_location_trigger keeps the PostGIS `location` column in sync from
-- latitude/longitude, so no geometry is written by hand here.

BEGIN;

-- Step 1: Only one festival may be active (idx_festivals_single_active is a unique partial
-- index), so clear the current holder before inserting. Frühlingsfest 2026 is active today
-- despite having ended in May.
UPDATE festivals SET is_active = false WHERE is_active = true;

-- Step 2: New tents for 2026.
-- Bartls Flößerstadl (398 seats) takes over the Münchner Stubn plot, so it inherits that
-- position. Münchner Stubn itself is not linked to 2026.
INSERT INTO tents (id, name, category, latitude, longitude) VALUES
  ('c0000000-0000-4000-b000-000000000001', 'Bartls Flößerstadl', 'small', 48.13138, 11.54925),
  ('c0000000-0000-4000-b000-000000000002', 'Hühnerbraterei Poschner', 'small', 48.13266, 11.54864)
-- ON CONFLICT guard matches the Frühlingsfest precedent. Note the whole migration is wrapped in
-- a transaction, so a failure rolls back entirely and there is no partial state to retry over.
-- The guard only matters if someone deletes the festival row by hand and re-runs this file.
ON CONFLICT (id) DO NOTHING;

-- Step 3: Fix the long-standing misspelling.
UPDATE tents SET name = 'Museumszelt'
WHERE id = '655190b1-ca0d-4d5a-8def-74f8a20f1e2b';

-- Step 4: Replace fabricated coordinates with OSM-sourced ones, for the 2026 lineup only.
-- Tents belonging to other festivals are deliberately untouched.
UPDATE tents AS t SET latitude = v.lat, longitude = v.lon
FROM (VALUES
  -- Large tents
  ('55ff3af6-f1d6-481a-a8f4-58fa23f00f68'::uuid, 48.13474, 11.54871), -- Armbrustschützen Festzelt
  ('631abb99-4237-4bbc-94d7-2a6c18e11e25'::uuid, 48.13286, 11.55006), -- Augustiner-Festhalle
  ('9eb72005-8026-4665-be77-4a61fbcc3fa1'::uuid, 48.13217, 11.54814), -- Festhalle Schottenhamel
  ('da36b13f-1e75-4299-9f75-1de4eb38b416'::uuid, 48.13484, 11.55018), -- Fischer-Vroni
  ('282d326c-0e14-43e2-b8c6-9bf098a0fde6'::uuid, 48.13305, 11.54816), -- Hacker-Festzelt
  ('253eb29d-8efe-4095-9671-4eff02704c4a'::uuid, 48.13390, 11.54841), -- Hofbräu-Festzelt
  ('37ad3fc4-9d52-4e19-91c7-a01ed11c6854'::uuid, 48.13030, 11.54729), -- Käfer Wiesn-Schänke
  ('2661d289-5ecd-42a0-9a59-eaf5ef94f92d'::uuid, 48.13006, 11.54988), -- Kufflers Weinzelt
  ('dd7b4b6d-7a57-411a-baf8-8c0d20682b64'::uuid, 48.13098, 11.54969), -- Löwenbräu-Festzelt
  ('49449d2f-c9b7-4b8b-9ed7-889690493c3d'::uuid, 48.13537, 11.54906), -- Marstall-Festzelt
  ('017977ea-a9c3-4865-b494-edc49efc6212'::uuid, 48.13412, 11.55041), -- Ochsenbraterei
  ('0935a117-4fe2-46fb-b8fa-fc45d9496af9'::uuid, 48.13117, 11.54788), -- Paulaner Festzelt
  ('4d140654-f235-44b8-8d6e-8f23e57274a2'::uuid, 48.13195, 11.54992), -- Pschorr-Festzelt Bräurosl
  ('5deac267-6401-437f-adae-e81769e4e781'::uuid, 48.13124, 11.54692), -- Schützen-Festzelt
  -- Oide Wiesn
  ('907342a2-ab22-4b27-8ebd-f7225a4d13e7'::uuid, 48.12876, 11.54607), -- Boandlkramerei
  ('f2df3186-ec0d-467f-a560-fffa48a72897'::uuid, 48.12863, 11.54748), -- Festzelt Tradition
  ('655190b1-ca0d-4d5a-8def-74f8a20f1e2b'::uuid, 48.12781, 11.54727), -- Museumszelt
  ('e61d04d2-6a16-4069-bf79-85dcf4827c94'::uuid, 48.12837, 11.54617), -- Volkssängerzelt Schützenlisl
  -- Small tents
  ('bbbf2c29-7b2e-487a-bcfc-c4b75547f83a'::uuid, 48.13340, 11.55039), -- Bodo's Cafézelt
  ('1764c5e2-6f01-4119-a55a-7d0efe3ae861'::uuid, 48.13222, 11.55073), -- Café Theres'
  ('28a517af-f440-4102-9ad3-beaed8347061'::uuid, 48.13135, 11.54857), -- Feisingers Kas- und Weinstubn
  ('f8e94181-3a63-4e68-9285-588038be343f'::uuid, 48.13144, 11.55080), -- Fisch-Bäda
  ('6fcea9eb-c5c5-4d8f-9363-cbd86119128e'::uuid, 48.13147, 11.54852), -- Glöckle-Wirt
  ('f02ae7eb-3c8c-4e38-ae4a-7b0f9fc5e404'::uuid, 48.13325, 11.54892), -- Goldener Hahn
  ('6d4e022d-c033-4a56-a19b-441dfe8430fd'::uuid, 48.13325, 11.55104), -- Heimer Enten- und Hühnerbraterei
  ('e2eae4f6-8da8-46db-b76a-d1fb50eca8f6'::uuid, 48.13171, 11.54857), -- Heinz Wurst- und Hühnerbraterei
  ('ecaae5eb-9745-4359-826a-9a14aa91591b'::uuid, 48.13343, 11.54889), -- Hochreiters Haxnbraterei
  ('24b50db1-f7c1-4132-a07c-00ad2cb8c2e1'::uuid, 48.13345, 11.54979), -- Hühner- und Entenbraterei Ammer
  ('2196e0ea-1262-4f2c-97ef-bcd67104ae72'::uuid, 48.13232, 11.54938), -- Kalbsbraterei
  ('0898010d-693f-47be-b8f2-5916ad5a56d0'::uuid, 48.12919, 11.54917), -- Münchner Knödelei
  ('cb0a2849-159f-48f6-902f-fba73ae9c9a2'::uuid, 48.13067, 11.55050), -- Rischart's Café Kaiserschmarrn
  ('014c7c7e-f904-4fcc-931f-2b80c9ceff2b'::uuid, 48.13416, 11.54924), -- Schiebl's Kaffeehaferl
  ('949ee890-ee80-406c-af23-ded34e838b44'::uuid, 48.13437, 11.54922), -- Vinzenzmurr Metzger Stubn
  ('5162f382-2321-495c-b723-942a4708811e'::uuid, 48.13008, 11.55243), -- Wildstuben
  ('b349fe59-e104-42f1-9157-1859d829c1fa'::uuid, 48.13387, 11.55242), -- Wirtshaus im Schichtl
  ('387574a0-8c63-4bf0-a4d0-a0bc37158ddd'::uuid, 48.13029, 11.55261)  -- Zur Bratwurst
) AS v(id, lat, lon)
WHERE t.id = v.id;

-- Step 5: Two 2026 tents have no trustworthy coordinate source. NULL them rather than keep
-- fabricated values: get_nearby_tents filters on `location IS NOT NULL`, so they are simply
-- omitted from proximity results instead of pointing users at the wrong place.
UPDATE tents SET latitude = NULL, longitude = NULL
WHERE id IN (
  'a20effb6-612e-4085-8de0-6fbc0dff1dc1', -- Münchner Weißbiergarten
  '7b91d421-5052-4109-b47f-8136f3bb9a89'  -- Wiesn Guglhupf
);

-- Step 6: The festival itself. status 'upcoming' matches the runtime value that
-- packages/shared/src/utils/festival-status.ts derives from the dates.
INSERT INTO festivals (
  name, short_name, festival_type, location,
  start_date, end_date, map_url,
  is_active, status, description,
  beer_cost, default_beer_price_cents,
  latitude, longitude
) VALUES (
  'Oktoberfest 2026',
  'oktoberfest-2026',
  'oktoberfest',
  'Munich, Germany',
  '2026-09-19',
  '2026-10-04',
  'https://www.muenchen.de/en/events/oktoberfest',
  true,
  'upcoming',
  'The 191st Oktoberfest on the Theresienwiese, 16 days from 19 September to 4 October 2026',
  15.80,
  1580,
  48.1314,
  11.5498
);

-- Step 7: Link the 40 tents of the 2026 lineup with their Maß prices. Tents with no published
-- 2026 price carry the 1580 base.
INSERT INTO festival_tents (festival_id, tent_id, beer_price, beer_price_cents)
SELECT
  (SELECT id FROM festivals WHERE short_name = 'oktoberfest-2026'),
  v.tent_id,
  v.cents / 100.0,
  v.cents
FROM (VALUES
  -- Large tents
  ('55ff3af6-f1d6-481a-a8f4-58fa23f00f68'::uuid, 1590), -- Armbrustschützen Festzelt
  ('631abb99-4237-4bbc-94d7-2a6c18e11e25'::uuid, 1490), -- Augustiner-Festhalle
  ('9eb72005-8026-4665-be77-4a61fbcc3fa1'::uuid, 1580), -- Festhalle Schottenhamel
  ('da36b13f-1e75-4299-9f75-1de4eb38b416'::uuid, 1575), -- Fischer-Vroni
  ('282d326c-0e14-43e2-b8c6-9bf098a0fde6'::uuid, 1580), -- Hacker-Festzelt
  ('253eb29d-8efe-4095-9671-4eff02704c4a'::uuid, 1580), -- Hofbräu-Festzelt
  ('37ad3fc4-9d52-4e19-91c7-a01ed11c6854'::uuid, 1580), -- Käfer Wiesn-Schänke
  ('2661d289-5ecd-42a0-9a59-eaf5ef94f92d'::uuid, 1780), -- Kufflers Weinzelt
  ('dd7b4b6d-7a57-411a-baf8-8c0d20682b64'::uuid, 1590), -- Löwenbräu-Festzelt
  ('49449d2f-c9b7-4b8b-9ed7-889690493c3d'::uuid, 1580), -- Marstall-Festzelt
  ('017977ea-a9c3-4865-b494-edc49efc6212'::uuid, 1580), -- Ochsenbraterei
  ('0935a117-4fe2-46fb-b8fa-fc45d9496af9'::uuid, 1580), -- Paulaner Festzelt
  ('4d140654-f235-44b8-8d6e-8f23e57274a2'::uuid, 1590), -- Pschorr-Festzelt Bräurosl
  ('5deac267-6401-437f-adae-e81769e4e781'::uuid, 1580), -- Schützen-Festzelt
  -- Oide Wiesn
  ('907342a2-ab22-4b27-8ebd-f7225a4d13e7'::uuid, 1530), -- Boandlkramerei
  ('f2df3186-ec0d-467f-a560-fffa48a72897'::uuid, 1580), -- Festzelt Tradition
  ('655190b1-ca0d-4d5a-8def-74f8a20f1e2b'::uuid, 1480), -- Museumszelt
  ('e61d04d2-6a16-4069-bf79-85dcf4827c94'::uuid, 1490), -- Volkssängerzelt Schützenlisl
  -- Small tents
  ('c0000000-0000-4000-b000-000000000001'::uuid, 1570), -- Bartls Flößerstadl
  ('bbbf2c29-7b2e-487a-bcfc-c4b75547f83a'::uuid, 1580), -- Bodo's Cafézelt
  ('1764c5e2-6f01-4119-a55a-7d0efe3ae861'::uuid, 1580), -- Café Theres'
  ('28a517af-f440-4102-9ad3-beaed8347061'::uuid, 1580), -- Feisingers Kas- und Weinstubn
  ('f8e94181-3a63-4e68-9285-588038be343f'::uuid, 1580), -- Fisch-Bäda
  ('6fcea9eb-c5c5-4d8f-9363-cbd86119128e'::uuid, 1580), -- Glöckle-Wirt
  ('f02ae7eb-3c8c-4e38-ae4a-7b0f9fc5e404'::uuid, 1580), -- Goldener Hahn
  ('6d4e022d-c033-4a56-a19b-441dfe8430fd'::uuid, 1580), -- Heimer Enten- und Hühnerbraterei
  ('e2eae4f6-8da8-46db-b76a-d1fb50eca8f6'::uuid, 1580), -- Heinz Wurst- und Hühnerbraterei
  ('ecaae5eb-9745-4359-826a-9a14aa91591b'::uuid, 1570), -- Hochreiters Haxnbraterei
  ('24b50db1-f7c1-4132-a07c-00ad2cb8c2e1'::uuid, 1495), -- Hühner- und Entenbraterei Ammer
  ('c0000000-0000-4000-b000-000000000002'::uuid, 1580), -- Hühnerbraterei Poschner
  ('2196e0ea-1262-4f2c-97ef-bcd67104ae72'::uuid, 1580), -- Kalbsbraterei
  ('0898010d-693f-47be-b8f2-5916ad5a56d0'::uuid, 1580), -- Münchner Knödelei
  ('a20effb6-612e-4085-8de0-6fbc0dff1dc1'::uuid, 1480), -- Münchner Weißbiergarten
  ('cb0a2849-159f-48f6-902f-fba73ae9c9a2'::uuid, 1580), -- Rischart's Café Kaiserschmarrn
  ('014c7c7e-f904-4fcc-931f-2b80c9ceff2b'::uuid, 1580), -- Schiebl's Kaffeehaferl
  ('949ee890-ee80-406c-af23-ded34e838b44'::uuid, 1580), -- Vinzenzmurr Metzger Stubn
  ('7b91d421-5052-4109-b47f-8136f3bb9a89'::uuid, 1580), -- Wiesn Guglhupf
  ('5162f382-2321-495c-b723-942a4708811e'::uuid, 1580), -- Wildstuben
  ('b349fe59-e104-42f1-9157-1859d829c1fa'::uuid, 1490), -- Wirtshaus im Schichtl
  ('387574a0-8c63-4bf0-a4d0-a0bc37158ddd'::uuid, 1570)  -- Zur Bratwurst
) AS v(tent_id, cents);

-- Step 8: Festival-level drink prices from the 1580 base, using the same ratios as
-- 20260409174404_add_fruehlingsfest_2026.sql.
DO $$
DECLARE
  v_festival_id uuid;
  v_base_price integer := 1580;
BEGIN
  SELECT id INTO v_festival_id FROM festivals WHERE short_name = 'oktoberfest-2026';

  INSERT INTO drink_type_prices (festival_id, drink_type, price_cents) VALUES
    (v_festival_id, 'beer', v_base_price),
    (v_festival_id, 'radler', v_base_price),
    (v_festival_id, 'alcohol_free', ROUND(v_base_price * 0.90)::integer),
    (v_festival_id, 'wine', ROUND(v_base_price * 0.85)::integer),
    (v_festival_id, 'soft_drink', ROUND(v_base_price * 0.40)::integer),
    (v_festival_id, 'other', v_base_price);
END $$;

-- Step 9: Per-tent beer and radler overrides, only where the tent price differs from the base.
INSERT INTO drink_type_prices (festival_tent_id, drink_type, price_cents)
SELECT ft.id, d.drink_type, ft.beer_price_cents
FROM festival_tents ft
CROSS JOIN (VALUES ('beer'::drink_type), ('radler'::drink_type)) AS d(drink_type)
WHERE ft.festival_id = (SELECT id FROM festivals WHERE short_name = 'oktoberfest-2026')
  AND ft.beer_price_cents <> 1580;

COMMIT;
