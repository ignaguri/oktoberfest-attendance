-- Add multilingual support to preferred_language constraint
-- Adds support for German (de) and Spanish (es) in addition to English (en)

-- Drop the old constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS valid_language_code;

-- Add updated constraint with multilingual support
ALTER TABLE public.profiles
ADD CONSTRAINT valid_language_code
CHECK (preferred_language IS NULL OR preferred_language IN ('en', 'de', 'es'));

COMMENT ON COLUMN public.profiles.preferred_language IS
'User preferred language code (ISO 639-1). Supported: en (English), de (Deutsch), es (Español). NULL = auto-detect from browser.';
