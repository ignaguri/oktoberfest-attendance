-- Migration: Create consumptions table
-- Description: Per-drink tracking with pricing, replacing aggregated beer_count
-- Date: 2025-12-29

-- Create consumptions table for granular drink tracking
CREATE TABLE consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,
  tent_id UUID REFERENCES tents(id) ON DELETE SET NULL,
  drink_type drink_type NOT NULL DEFAULT 'beer',
  drink_name TEXT,
  base_price_cents INTEGER NOT NULL,
  price_paid_cents INTEGER NOT NULL,
  tip_cents INTEGER GENERATED ALWAYS AS (price_paid_cents - base_price_cents) STORED,
  volume_ml INTEGER DEFAULT 1000,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consumptions_positive_price CHECK (base_price_cents >= 0),
  CONSTRAINT consumptions_paid_gte_base CHECK (price_paid_cents >= base_price_cents),
  CONSTRAINT consumptions_positive_volume CHECK (volume_ml > 0)
);

-- Add indexes for common queries
CREATE INDEX idx_consumptions_attendance ON consumptions(attendance_id);
CREATE INDEX idx_consumptions_tent ON consumptions(tent_id);
CREATE INDEX idx_consumptions_recorded_at ON consumptions(recorded_at DESC);
CREATE INDEX idx_consumptions_drink_type ON consumptions(drink_type);

-- Create partial unique index for idempotency
CREATE UNIQUE INDEX idx_consumptions_idempotency_unique
  ON consumptions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE consumptions IS 'Individual drink consumption records with pricing details';
COMMENT ON COLUMN consumptions.attendance_id IS 'References the attendance record for this consumption';
COMMENT ON COLUMN consumptions.tent_id IS 'Optional tent where drink was purchased';
COMMENT ON COLUMN consumptions.drink_type IS 'Type of beverage consumed';
COMMENT ON COLUMN consumptions.drink_name IS 'Optional custom drink name (e.g., "Augustiner Edelstoff")';
COMMENT ON COLUMN consumptions.base_price_cents IS 'Base price of drink in cents (e.g., 1620 for €16.20)';
COMMENT ON COLUMN consumptions.price_paid_cents IS 'Actual price paid including tip';
COMMENT ON COLUMN consumptions.tip_cents IS 'Automatically calculated tip amount';
COMMENT ON COLUMN consumptions.volume_ml IS 'Volume in milliliters (default 1000ml for Maß)';
COMMENT ON COLUMN consumptions.recorded_at IS 'When the consumption was recorded';
COMMENT ON COLUMN consumptions.idempotency_key IS 'Optional key for preventing duplicate submissions';

-- Enable Row Level Security
ALTER TABLE consumptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own consumptions
CREATE POLICY "Users can view own consumptions"
  ON consumptions
  FOR SELECT
  USING (
    attendance_id IN (
      SELECT id FROM attendances WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert their own consumptions
CREATE POLICY "Users can insert own consumptions"
  ON consumptions
  FOR INSERT
  WITH CHECK (
    attendance_id IN (
      SELECT id FROM attendances WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update their own consumptions
CREATE POLICY "Users can update own consumptions"
  ON consumptions
  FOR UPDATE
  USING (
    attendance_id IN (
      SELECT id FROM attendances WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete their own consumptions
CREATE POLICY "Users can delete own consumptions"
  ON consumptions
  FOR DELETE
  USING (
    attendance_id IN (
      SELECT id FROM attendances WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Group members can view consumptions of other group members
CREATE POLICY "Group members can view member consumptions"
  ON consumptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM attendances a
      JOIN group_members gm1 ON gm1.user_id = a.user_id
      JOIN groups g ON g.id = gm1.group_id
      JOIN group_members gm2 ON gm2.group_id = g.id
      WHERE a.id = consumptions.attendance_id
        AND gm2.user_id = auth.uid()
        AND a.festival_id = g.festival_id
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_consumptions_updated_at
  BEFORE UPDATE ON consumptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
