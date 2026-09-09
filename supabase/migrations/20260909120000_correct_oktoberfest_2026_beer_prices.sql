-- Correct the Oktoberfest 2026 Maß prices that moved after the lineup was
-- seeded in 20260804121948_add_oktoberfest_2026.sql.
--
-- That migration was built from the June price tables. The operators' final
-- figures, published by muenchen.de and oktoberfest.de, differ for eight
-- tents: the Weinzelt's Weissbier Maß went to 18.40, four small tents joined
-- the 15.90 top price, and three came in under the 15.80 base.
--
-- Prices live in two places. festival_tents.beer_price(_cents) is the legacy
-- column, and drink_type_prices is what the app actually charges. A tent only
-- gets drink_type_prices rows when it deviates from the festival's 15.80
-- default, and always as a beer/radler pair at the same price, so seven of
-- these eight need rows inserted rather than updated.

WITH corrected(tent_id, cents) AS (
  VALUES
    ('2661d289-5ecd-42a0-9a59-eaf5ef94f92d'::uuid, 1840), -- Kufflers Weinzelt (was 1780)
    ('6fcea9eb-c5c5-4d8f-9363-cbd86119128e'::uuid, 1590), -- Glöckle-Wirt (was 1580)
    ('f02ae7eb-3c8c-4e38-ae4a-7b0f9fc5e404'::uuid, 1590), -- Goldener Hahn (was 1580)
    ('e2eae4f6-8da8-46db-b76a-d1fb50eca8f6'::uuid, 1590), -- Heinz Wurst- und Hühnerbraterei (was 1580)
    ('c0000000-0000-4000-b000-000000000002'::uuid, 1590), -- Hühnerbraterei Poschner (was 1580)
    ('28a517af-f440-4102-9ad3-beaed8347061'::uuid, 1560), -- Feisingers Kas- und Weinstubn (was 1580)
    ('6d4e022d-c033-4a56-a19b-441dfe8430fd'::uuid, 1570), -- Heimer Enten- und Hühnerbraterei (was 1580)
    ('0898010d-693f-47be-b8f2-5916ad5a56d0'::uuid, 1570)  -- Münchner Knödelei (was 1580)
),
target AS (
  SELECT ft.id AS festival_tent_id, c.cents
  FROM corrected c
  JOIN festivals f ON f.short_name = 'oktoberfest-2026'
  JOIN festival_tents ft ON ft.festival_id = f.id AND ft.tent_id = c.tent_id
),
legacy_update AS (
  UPDATE festival_tents ft
  SET beer_price = t.cents / 100.0,
      beer_price_cents = t.cents
  FROM target t
  WHERE ft.id = t.festival_tent_id
  RETURNING 1
)
-- festival_id stays NULL on a tent-scoped row; drink_type_prices_one_parent
-- allows exactly one of the two parents to be set.
INSERT INTO drink_type_prices (festival_tent_id, drink_type, price_cents)
SELECT t.festival_tent_id, d.drink_type, t.cents
FROM target t
CROSS JOIN (VALUES ('beer'::drink_type), ('radler'::drink_type)) AS d(drink_type)
ON CONFLICT (festival_tent_id, drink_type) WHERE festival_tent_id IS NOT NULL
DO UPDATE SET price_cents = EXCLUDED.price_cents,
              updated_at = now();
