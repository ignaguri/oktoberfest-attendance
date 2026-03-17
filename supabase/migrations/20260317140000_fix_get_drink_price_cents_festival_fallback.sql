-- Fix get_drink_price_cents to check festivals.beer_cost before hardcoded defaults
--
-- ROOT CAUSE: The RPC only checked the drink_type_prices table for festival
-- prices. Festivals like Starkbierfest 2026 that have beer_cost set on the
-- festivals table but no rows in drink_type_prices would fall through to
-- the hardcoded default (1620), which is higher than the actual festival
-- price (1490). The mobile client correctly reads festivals.beer_cost and
-- sends pricePaidCents=1490, but the server resolves basePriceCents=1620,
-- violating the consumptions_paid_gte_base CHECK constraint.
--
-- FIX: Add a Priority 2.5 step that derives prices from festivals.beer_cost
-- when no drink_type_prices rows exist for the festival.

CREATE OR REPLACE FUNCTION get_drink_price_cents(
    p_festival_id uuid,
    p_tent_id uuid DEFAULT NULL,
    p_drink_type drink_type DEFAULT 'beer'
) RETURNS integer AS $$
DECLARE
    v_price_cents integer;
    v_festival_tent_id uuid;
    v_beer_cost numeric;
BEGIN
    -- Priority 1: Tent-specific price (if tent_id provided)
    IF p_tent_id IS NOT NULL THEN
        SELECT ft.id INTO v_festival_tent_id
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
