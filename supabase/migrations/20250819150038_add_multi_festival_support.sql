-- Multi-Festival Support Migration
-- Phase 1: Create festivals infrastructure

-- Create enums for festival types and statuses
CREATE TYPE festival_type_enum AS ENUM ('oktoberfest', 'starkbierfest', 'fruehlingsfest', 'other');
CREATE TYPE festival_status_enum AS ENUM ('upcoming', 'active', 'ended');

-- Create festivals table
CREATE TABLE festivals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(100) NOT NULL UNIQUE,
  festival_type festival_type_enum NOT NULL,
  location VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL, 
  map_url TEXT,
  timezone VARCHAR(100) NOT NULL DEFAULT 'Europe/Berlin',
  is_active BOOLEAN NOT NULL DEFAULT false,
  status festival_status_enum NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure only one festival can be active at a time
CREATE UNIQUE INDEX idx_festivals_single_active ON festivals (is_active) WHERE is_active = true;

-- Create indexes for performance
CREATE INDEX idx_festivals_type ON festivals(festival_type);
CREATE INDEX idx_festivals_status ON festivals(status);
CREATE INDEX idx_festivals_dates ON festivals(start_date, end_date);

-- Create festival_tent_pricing table for tent-specific pricing
CREATE TABLE festival_tent_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  tent_id UUID NOT NULL REFERENCES tents(id) ON DELETE CASCADE,
  beer_price DECIMAL(5,2) NOT NULL CHECK (beer_price > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  price_start_date DATE,
  price_end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure unique pricing per tent per festival (per period)
  CONSTRAINT unique_tent_festival_pricing UNIQUE (festival_id, tent_id, price_start_date)
);

-- Index for fast pricing lookups
CREATE INDEX idx_festival_tent_pricing_lookup ON festival_tent_pricing(festival_id, tent_id);
CREATE INDEX idx_festival_tent_pricing_dates ON festival_tent_pricing(price_start_date, price_end_date);

-- Insert current 2024 Oktoberfest data as the first festival
INSERT INTO festivals (
  name, short_name, festival_type, location, 
  start_date, end_date, map_url, 
  is_active, status, description
) VALUES (
  'Oktoberfest 2024', 
  'oktoberfest-2024',
  'oktoberfest',
  'Munich, Germany',
  '2024-09-21',
  '2024-10-06', 
  'https://wiesnmap.muenchen.de/',
  false,  -- Set to false since it's ended
  'ended',
  'The 189th Oktoberfest in Munich'
);

-- Get the festival_id for 2024 Oktoberfest (for use in next migration steps)
-- Migrate existing tent pricing for 2024 Oktoberfest
-- Since we don't have historical tent-specific pricing, use the current constant (16.2)
INSERT INTO festival_tent_pricing (festival_id, tent_id, beer_price, price_start_date)
SELECT 
  (SELECT id FROM festivals WHERE short_name = 'oktoberfest-2024'),
  t.id,
  16.20,  -- Current COST_PER_BEER constant
  '2024-09-21'  -- Festival start date
FROM tents t;

-- Add update triggers
CREATE TRIGGER update_festivals_updated_at 
  BEFORE UPDATE ON festivals 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_festival_tent_pricing_updated_at 
  BEFORE UPDATE ON festival_tent_pricing 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on new tables
ALTER TABLE festivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE festival_tent_pricing ENABLE ROW LEVEL SECURITY;

-- RLS policies for festivals (readable by all authenticated users)
CREATE POLICY "Festivals are viewable by all authenticated users"
  ON festivals FOR SELECT
  TO authenticated
  USING (true);

-- Only super admins can manage festivals (will be refined later)
CREATE POLICY "Super admins can manage festivals"
  ON festivals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_super_admin = true
    )
  );

-- RLS policies for festival_tent_pricing (readable by all authenticated users)
CREATE POLICY "Festival tent pricing is viewable by all authenticated users"
  ON festival_tent_pricing FOR SELECT
  TO authenticated
  USING (true);

-- Only super admins can manage pricing
CREATE POLICY "Super admins can manage festival tent pricing"
  ON festival_tent_pricing FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_super_admin = true
    )
  );