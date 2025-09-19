-- Drop the old festival_tent_pricing table after successful migration to festival_tents
-- This migration should be run only after confirming the new system is working properly

-- Drop the old table and all its dependencies
DROP TABLE IF EXISTS festival_tent_pricing CASCADE;

-- Add helpful comment (only if festival_tents exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'festival_tents') THEN
    COMMENT ON TABLE festival_tents IS 'Clean junction table linking festivals to their available tents with optional tent-specific pricing. Replaces the old festival_tent_pricing table.';
  END IF;
END $$;