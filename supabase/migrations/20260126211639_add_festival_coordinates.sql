-- Add latitude and longitude columns to festivals table
-- This allows each festival to have its own map center coordinates

ALTER TABLE public.festivals
ADD COLUMN latitude double precision,
ADD COLUMN longitude double precision;

-- Add comment explaining the columns
COMMENT ON COLUMN public.festivals.latitude IS 'Festival venue center latitude for map display';
COMMENT ON COLUMN public.festivals.longitude IS 'Festival venue center longitude for map display';

-- Update existing festivals with their coordinates
-- Oktoberfest (Theresienwiese, Munich)
UPDATE public.festivals
SET latitude = 48.1314, longitude = 11.5498
WHERE name ILIKE '%oktoberfest%';

-- Frühlingsfest (Theresienwiese, Munich - same location as Oktoberfest)
UPDATE public.festivals
SET latitude = 48.1314, longitude = 11.5498
WHERE name ILIKE '%frühlingsfest%' OR name ILIKE '%fruehlingsfest%' OR name ILIKE '%spring%fest%';

-- Starkbierfest (Nockherberg, Munich)
UPDATE public.festivals
SET latitude = 48.1189, longitude = 11.5892
WHERE name ILIKE '%starkbier%';
