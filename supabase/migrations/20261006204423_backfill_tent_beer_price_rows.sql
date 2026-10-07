-- The web admin wrote festival_tents.beer_price(_cents) without the canonical
-- drink_type_prices row. get_drink_price_cents falls back to the columns, so
-- prices were right, but the row is the source of truth: create the missing ones.
INSERT INTO public.drink_type_prices (festival_tent_id, drink_type, price_cents)
SELECT ft.id, 'beer', COALESCE(ft.beer_price_cents, round(ft.beer_price * 100)::int)
FROM public.festival_tents ft
WHERE COALESCE(ft.beer_price_cents, round(ft.beer_price * 100)::int) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.drink_type_prices dtp
    WHERE dtp.festival_tent_id = ft.id
      AND dtp.drink_type = 'beer'
  );
