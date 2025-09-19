-- Add beer_cost column to festivals table
-- This provides festival-level default beer pricing for tent pricing fallbacks

-- Add the beer_cost column to festivals table
ALTER TABLE festivals
ADD COLUMN beer_cost DECIMAL(5,2) CHECK (beer_cost IS NULL OR beer_cost > 0);

-- Update existing festivals with default beer cost
UPDATE festivals
SET beer_cost = 16.20
WHERE beer_cost IS NULL;

-- Add helpful comment
COMMENT ON COLUMN festivals.beer_cost IS 'Default beer price for this festival. Used as fallback when tents do not have specific pricing in festival_tents table.';