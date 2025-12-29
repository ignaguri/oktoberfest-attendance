-- Migration: Create drink_type enum
-- Description: Adds enum type for flexible beverage tracking
-- Date: 2025-12-29

-- Create drink_type enum
CREATE TYPE drink_type AS ENUM (
  'beer',           -- Standard beer (Maß)
  'radler',         -- Beer mixed with lemonade
  'alcohol_free',   -- Non-alcoholic beer
  'wine',           -- Wine (Wein)
  'soft_drink',     -- Soft drinks (Cola, Sprite, etc.)
  'other'           -- Other beverages
);

-- Add comment for documentation
COMMENT ON TYPE drink_type IS 'Types of drinks that can be consumed and tracked';
