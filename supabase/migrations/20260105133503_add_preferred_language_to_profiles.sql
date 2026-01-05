-- Add preferred_language column to profiles table
-- NULL = not set yet (will auto-detect on first use)
-- 'en' = English (default fallback)
-- Future: 'de', 'es', 'fr', etc.

ALTER TABLE public.profiles
ADD COLUMN preferred_language TEXT DEFAULT NULL;

-- Add check constraint for valid language codes
-- TODO: Add more languages when translations are available ('de', 'es', 'fr')
ALTER TABLE public.profiles
ADD CONSTRAINT valid_language_code
CHECK (preferred_language IS NULL OR preferred_language IN ('en'));

COMMENT ON COLUMN public.profiles.preferred_language IS
'User preferred language code (ISO 639-1). NULL = auto-detect from browser.';
