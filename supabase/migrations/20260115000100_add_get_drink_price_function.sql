-- Add function to resolve drink price with cascade: Tent -> Festival -> System Default

CREATE OR REPLACE FUNCTION get_drink_price_cents(
    p_festival_id uuid,
    p_tent_id uuid DEFAULT NULL,
    p_drink_type drink_type DEFAULT 'beer'
) RETURNS integer AS $$
DECLARE
    v_price_cents integer;
    v_festival_tent_id uuid;
BEGIN
    -- Priority 1: Tent-specific price (if tent_id provided)
    IF p_tent_id IS NOT NULL THEN
        -- First get the festival_tent_id for this festival/tent combination
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

    -- Priority 2: Festival default price
    SELECT dtp.price_cents INTO v_price_cents
    FROM drink_type_prices dtp
    WHERE dtp.festival_id = p_festival_id
      AND dtp.drink_type = p_drink_type;

    IF v_price_cents IS NOT NULL THEN
        RETURN v_price_cents;
    END IF;

    -- Priority 3: System defaults (hardcoded)
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

COMMENT ON FUNCTION get_drink_price_cents IS 'Resolves drink price using cascade: Tent override -> Festival default -> System default. All prices in cents.';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_drink_price_cents TO authenticated;
