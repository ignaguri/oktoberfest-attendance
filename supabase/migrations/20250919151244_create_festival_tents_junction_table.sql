-- Create festival_tents junction table to replace complex festival_tent_pricing
-- This provides a clean many-to-many relationship between festivals and tents
-- with optional tent-specific beer pricing

-- Create the new festival_tents junction table
CREATE TABLE festival_tents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  tent_id UUID NOT NULL REFERENCES tents(id) ON DELETE CASCADE,
  beer_price DECIMAL(5,2) NULL CHECK (beer_price IS NULL OR beer_price > 0), -- Optional tent-specific price
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure each tent can only be assigned once per festival
  CONSTRAINT unique_festival_tent UNIQUE (festival_id, tent_id)
);

-- Create indexes for performance
CREATE INDEX idx_festival_tents_festival_id ON festival_tents(festival_id);
CREATE INDEX idx_festival_tents_tent_id ON festival_tents(tent_id);
CREATE INDEX idx_festival_tents_lookup ON festival_tents(festival_id, tent_id);

-- Migrate existing data from festival_tent_pricing to festival_tents (if it exists)
-- This preserves all current festival-tent relationships and pricing
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'festival_tent_pricing') THEN
    INSERT INTO festival_tents (festival_id, tent_id, beer_price, created_at)
    SELECT
      festival_id,
      tent_id,
      beer_price,
      created_at
    FROM festival_tent_pricing
    -- Only migrate records with valid pricing (ignore complex date-based pricing for now)
    WHERE price_start_date IS NULL OR price_start_date <= NOW();

    RAISE NOTICE 'Migrated data from festival_tent_pricing to festival_tents';
  ELSE
    RAISE NOTICE 'festival_tent_pricing table not found, skipping data migration';
  END IF;
END $$;

-- Add update trigger for updated_at
CREATE TRIGGER update_festival_tents_updated_at
  BEFORE UPDATE ON festival_tents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on the new table
ALTER TABLE festival_tents ENABLE ROW LEVEL SECURITY;

-- RLS policies for festival_tents (readable by all authenticated users)
CREATE POLICY "Festival tents are viewable by all authenticated users"
  ON festival_tents FOR SELECT
  TO authenticated
  USING (true);

-- Only super admins can manage festival tent assignments
CREATE POLICY "Only super admins can manage festival tents"
  ON festival_tents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_super_admin = true
    )
  );

-- Add helpful comments
COMMENT ON TABLE festival_tents IS 'Junction table linking festivals to their available tents with optional pricing';
COMMENT ON COLUMN festival_tents.beer_price IS 'Optional tent-specific beer price. NULL means use festival default price';
COMMENT ON COLUMN festival_tents.festival_id IS 'References the festival this tent belongs to';
COMMENT ON COLUMN festival_tents.tent_id IS 'References the tent available in this festival';