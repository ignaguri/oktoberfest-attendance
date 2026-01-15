-- Pricing System Overhaul: Phase 1
-- Creates drink_type_prices table for per-drink-type pricing at festival and tent levels
-- Migrates existing euro prices to cents

-- Step 1: Create drink_type_prices table
CREATE TABLE public.drink_type_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    -- Polymorphic association: either festival_id OR festival_tent_id is set
    festival_id uuid REFERENCES festivals(id) ON DELETE CASCADE,
    festival_tent_id uuid REFERENCES festival_tents(id) ON DELETE CASCADE,
    drink_type public.drink_type NOT NULL,
    price_cents integer NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Ensure exactly one parent is set
    CONSTRAINT drink_type_prices_one_parent CHECK (
        (festival_id IS NOT NULL AND festival_tent_id IS NULL) OR
        (festival_id IS NULL AND festival_tent_id IS NOT NULL)
    ),
    -- Positive price constraint
    CONSTRAINT drink_type_prices_positive_price CHECK (price_cents > 0)
);

-- Unique constraints (separate to avoid NULLS NOT DISTINCT compatibility issues)
CREATE UNIQUE INDEX drink_type_prices_festival_unique
ON drink_type_prices(festival_id, drink_type)
WHERE festival_id IS NOT NULL;

CREATE UNIQUE INDEX drink_type_prices_tent_unique
ON drink_type_prices(festival_tent_id, drink_type)
WHERE festival_tent_id IS NOT NULL;

-- Step 2: Add new cents columns to existing tables (non-destructive)
ALTER TABLE festivals ADD COLUMN default_beer_price_cents integer;
ALTER TABLE festival_tents ADD COLUMN beer_price_cents integer;

-- Step 3: Migrate existing euro prices to cents
UPDATE festivals
SET default_beer_price_cents = ROUND(beer_cost * 100)::integer
WHERE beer_cost IS NOT NULL;

UPDATE festival_tents
SET beer_price_cents = ROUND(beer_price * 100)::integer
WHERE beer_price IS NOT NULL;

-- Step 4: Populate drink_type_prices from festivals (default prices for each drink type)
-- Use DO block to handle each drink type
DO $$
DECLARE
    fest RECORD;
    base_price integer;
BEGIN
    FOR fest IN SELECT id, default_beer_price_cents FROM festivals LOOP
        base_price := COALESCE(fest.default_beer_price_cents, 1620);

        -- Beer
        INSERT INTO drink_type_prices (festival_id, drink_type, price_cents)
        VALUES (fest.id, 'beer', base_price)
        ON CONFLICT DO NOTHING;

        -- Radler (same as beer)
        INSERT INTO drink_type_prices (festival_id, drink_type, price_cents)
        VALUES (fest.id, 'radler', base_price)
        ON CONFLICT DO NOTHING;

        -- Wine (~85% of beer)
        INSERT INTO drink_type_prices (festival_id, drink_type, price_cents)
        VALUES (fest.id, 'wine', ROUND(base_price * 0.85)::integer)
        ON CONFLICT DO NOTHING;

        -- Soft drinks (~40% of beer)
        INSERT INTO drink_type_prices (festival_id, drink_type, price_cents)
        VALUES (fest.id, 'soft_drink', ROUND(base_price * 0.40)::integer)
        ON CONFLICT DO NOTHING;

        -- Alcohol-free (~90% of beer)
        INSERT INTO drink_type_prices (festival_id, drink_type, price_cents)
        VALUES (fest.id, 'alcohol_free', ROUND(base_price * 0.90)::integer)
        ON CONFLICT DO NOTHING;

        -- Other (same as beer)
        INSERT INTO drink_type_prices (festival_id, drink_type, price_cents)
        VALUES (fest.id, 'other', base_price)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- Step 5: Create additional indexes for performance
CREATE INDEX idx_drink_type_prices_festival ON drink_type_prices(festival_id) WHERE festival_id IS NOT NULL;
CREATE INDEX idx_drink_type_prices_tent ON drink_type_prices(festival_tent_id) WHERE festival_tent_id IS NOT NULL;
CREATE INDEX idx_drink_type_prices_type ON drink_type_prices(drink_type);

-- Step 6: Add RLS policies
ALTER TABLE drink_type_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read drink type prices"
ON drink_type_prices FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Super admins can manage drink type prices"
ON drink_type_prices FOR ALL
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Step 7: Add comments
COMMENT ON TABLE drink_type_prices IS 'Pricing configuration per drink type. Can be set at festival level (default) or festival_tent level (override).';
COMMENT ON COLUMN drink_type_prices.price_cents IS 'Price in cents (e.g., 1620 = €16.20)';
COMMENT ON COLUMN drink_type_prices.festival_id IS 'Festival this price applies to (for festival-wide defaults)';
COMMENT ON COLUMN drink_type_prices.festival_tent_id IS 'Festival-tent this price applies to (for tent-specific overrides)';
COMMENT ON COLUMN festivals.default_beer_price_cents IS 'Default beer price in cents. Legacy field - use drink_type_prices table for per-drink-type pricing.';
COMMENT ON COLUMN festival_tents.beer_price_cents IS 'Tent-specific beer price in cents. Legacy field - use drink_type_prices table for per-drink-type pricing.';
