-- Let the price cascade read a tent's own beer price.
--
-- Before this, get_drink_price_cents only looked at drink_type_prices, then
-- festivals.beer_cost, then a hardcoded constant. It never read
-- festival_tents.beer_price / beer_price_cents, even though that is the column
-- the admin panels write and the column the tent list displays.
--
-- In production 75 of the 103 priced festival_tents rows have no canonical
-- drink_type_prices row, because the web admin panel has only ever written
-- festival_tents.beer_price. For those tents the displayed price and the
-- charged price came from different columns: 18 Oktoberfest 2025 tents showed
-- 14.50-17.80 while charging the festival default of 16.20.
--
-- Slotting the tent's own price in right after the canonical per-tent row keeps
-- the specificity order intact (tent -> festival -> system) and closes that gap
-- without a backfill. Anything that already has a canonical row is unaffected.
--
-- Scoped to beer and radler on purpose: festival_tents.beer_price is a beer
-- price, and radler is priced as beer everywhere else in this schema. Every
-- other drink type keeps falling through to the festival price, which is what
-- makes a soft drink cost soft-drink money.

CREATE OR REPLACE FUNCTION public.get_drink_price_cents(
    p_festival_id uuid,
    p_tent_id uuid DEFAULT NULL::uuid,
    p_drink_type drink_type DEFAULT 'beer'::drink_type
)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_price_cents integer;
    v_festival_tent_id uuid;
    v_tent_beer_cents integer;
    v_beer_cost numeric;
BEGIN
    -- Priority 1: Tent-specific price (if tent_id provided)
    IF p_tent_id IS NOT NULL THEN
        -- beer_price_cents is the newer column; beer_price (euros) is what the
        -- web admin panel still writes, so fall back to it rather than lose the
        -- tent's price entirely.
        SELECT ft.id, COALESCE(ft.beer_price_cents, ROUND(ft.beer_price * 100)::integer)
        INTO v_festival_tent_id, v_tent_beer_cents
        FROM festival_tents ft
        WHERE ft.festival_id = p_festival_id
          AND ft.tent_id = p_tent_id;

        IF v_festival_tent_id IS NOT NULL THEN
            SELECT dtp.price_cents INTO v_price_cents
            FROM drink_type_prices dtp
            WHERE dtp.festival_tent_id = v_festival_tent_id
              AND dtp.drink_type = p_drink_type;

            IF v_price_cents IS NOT NULL THEN
                RETURN v_price_cents;
            END IF;

            -- Priority 1b: the tent's own beer price, for beer-like drinks only.
            IF v_tent_beer_cents IS NOT NULL AND p_drink_type IN ('beer', 'radler') THEN
                RETURN v_tent_beer_cents;
            END IF;
        END IF;
    END IF;

    -- Priority 2: Festival price from drink_type_prices table
    SELECT dtp.price_cents INTO v_price_cents
    FROM drink_type_prices dtp
    WHERE dtp.festival_id = p_festival_id
      AND dtp.drink_type = p_drink_type;

    IF v_price_cents IS NOT NULL THEN
        RETURN v_price_cents;
    END IF;

    -- Priority 3: Derive from festivals.beer_cost (matches client-side logic)
    -- beer_cost is stored in euros, convert to cents
    SELECT f.beer_cost INTO v_beer_cost
    FROM festivals f
    WHERE f.id = p_festival_id;

    IF v_beer_cost IS NOT NULL AND p_drink_type IN ('beer', 'radler') THEN
        RETURN ROUND(v_beer_cost * 100)::integer;
    END IF;

    -- Priority 4: System defaults (hardcoded)
    RETURN CASE p_drink_type
        WHEN 'beer' THEN 1620
        WHEN 'radler' THEN 1620
        WHEN 'wine' THEN 1400
        WHEN 'soft_drink' THEN 650
        WHEN 'alcohol_free' THEN 1450
        WHEN 'other' THEN 1620
        ELSE 1620
    END;
END;
$function$;
