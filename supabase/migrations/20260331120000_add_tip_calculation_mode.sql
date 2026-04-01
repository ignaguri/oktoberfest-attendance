-- Add tip calculation preferences to profiles
-- Modes: none, ceiling_plus_1, ceiling_plus_2, percentage_10, fixed
ALTER TABLE profiles
  ADD COLUMN tip_mode TEXT NOT NULL DEFAULT 'ceiling_plus_1'
    CHECK (tip_mode IN ('none', 'ceiling_plus_1', 'ceiling_plus_2', 'percentage_10', 'fixed')),
  ADD COLUMN tip_fixed_amount NUMERIC(5,2) DEFAULT NULL;

-- Document new columns; existing profile RLS policies already cover them
COMMENT ON COLUMN profiles.tip_mode IS 'Tip calculation mode: none, ceiling_plus_1, ceiling_plus_2, percentage_10, fixed';
COMMENT ON COLUMN profiles.tip_fixed_amount IS 'Fixed tip amount in euros (only used when tip_mode = fixed)';
