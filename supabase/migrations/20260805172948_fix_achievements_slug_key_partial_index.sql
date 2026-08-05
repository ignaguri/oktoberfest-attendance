-- The partial predicate was unnecessary: Postgres unique indexes already
-- treat NULL as distinct by default, so a plain unique index already lets
-- the legacy NULL-slug rows coexist. The partial form blocks PostgREST/
-- supabase-js upsert's ON CONFLICT (slug) inference, which cannot target
-- a partial index without a matching WHERE predicate it has no way to express.
DROP INDEX IF EXISTS public.achievements_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS achievements_slug_key
  ON public.achievements (slug);
