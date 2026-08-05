-- The revamp introduces two category names the enum does not yet carry.
-- Old values stay for now; Plan 2 removes them after the remap.
ALTER TYPE public.achievement_category_enum ADD VALUE IF NOT EXISTS 'drinking';
ALTER TYPE public.achievement_category_enum ADD VALUE IF NOT EXISTS 'dedication';
