-- Achievements engine: additive schema foundation.
-- The legacy plpgsql engine remains live; nothing here removes it.

-- 1. Registry columns on achievements.
-- slug is nullable at first because existing rows have none; Plan 2 backfills
-- and then sets NOT NULL.
ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS slug      text,
  ADD COLUMN IF NOT EXISTS series_id text,
  ADD COLUMN IF NOT EXISTS tier      smallint,
  ADD COLUMN IF NOT EXISTS scope     text;

ALTER TABLE public.achievements
  DROP CONSTRAINT IF EXISTS achievements_scope_check;
ALTER TABLE public.achievements
  ADD CONSTRAINT achievements_scope_check
  CHECK (scope IS NULL OR scope IN ('festival', 'lifetime'));

ALTER TABLE public.achievements
  DROP CONSTRAINT IF EXISTS achievements_tier_check;
ALTER TABLE public.achievements
  ADD CONSTRAINT achievements_tier_check
  CHECK (tier IS NULL OR tier BETWEEN 1 AND 4);

CREATE UNIQUE INDEX IF NOT EXISTS achievements_slug_key
  ON public.achievements (slug) WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS achievements_series_tier
  ON public.achievements (series_id, tier);

-- 2. Lifetime unlocks: festival_id becomes nullable.
-- Postgres 15 supports NULLS NOT DISTINCT, so no sentinel UUID is needed.
ALTER TABLE public.user_achievements ALTER COLUMN festival_id DROP NOT NULL;

ALTER TABLE public.user_achievements
  DROP CONSTRAINT IF EXISTS user_achievements_user_id_achievement_id_festival_id_key;

ALTER TABLE public.user_achievements
  DROP CONSTRAINT IF EXISTS user_achievements_unique;
ALTER TABLE public.user_achievements
  ADD CONSTRAINT user_achievements_unique
  UNIQUE NULLS NOT DISTINCT (user_id, achievement_id, festival_id);

-- 3. App activity tracking. Also serves BI: DAU/WAU/MAU, retention, platform split.
CREATE TABLE IF NOT EXISTS public.user_active_days (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day           date NOT NULL,
  platform      text,
  app_version   text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS user_active_days_day
  ON public.user_active_days (day);

ALTER TABLE public.user_active_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_active_days_select_own ON public.user_active_days;
CREATE POLICY user_active_days_select_own ON public.user_active_days
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 4. Materialized competitive standings.
CREATE TABLE IF NOT EXISTS public.festival_group_standings (
  festival_id  uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  group_id     uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  rank         integer NOT NULL,
  member_count integer NOT NULL,
  criteria_id  integer NOT NULL,
  computed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (festival_id, group_id, user_id)
);

CREATE INDEX IF NOT EXISTS festival_group_standings_user_rank
  ON public.festival_group_standings (user_id, rank);

ALTER TABLE public.festival_group_standings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS festival_group_standings_select_own ON public.festival_group_standings;
CREATE POLICY festival_group_standings_select_own ON public.festival_group_standings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 5. Wrapped view tracking. The write is wired up in Plan 3.
ALTER TABLE public.wrapped_data_cache
  ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz;

-- 6. Index gaps blocking the metrics function.
-- Verified missing against production pg_indexes on 2026-08-05.
CREATE INDEX IF NOT EXISTS idx_tent_visits_user_festival
  ON public.tent_visits (user_id, festival_id, tent_id);

CREATE INDEX IF NOT EXISTS idx_photo_reactions_user
  ON public.photo_reactions (user_id);

CREATE INDEX IF NOT EXISTS idx_groups_created_by
  ON public.groups (created_by, festival_id);

CREATE INDEX IF NOT EXISTS idx_attendances_user_festival
  ON public.attendances (user_id, festival_id) INCLUDE (id, date);

CREATE INDEX IF NOT EXISTS idx_tent_crowd_reports_user_festival
  ON public.tent_crowd_reports (user_id, festival_id);

-- Replaces idx_consumptions_attendance, which covers the same column.
-- Two indexes on (attendance_id) would be pure write overhead.
DROP INDEX IF EXISTS public.idx_consumptions_attendance;
CREATE INDEX IF NOT EXISTS idx_consumptions_attendance_covering
  ON public.consumptions (attendance_id)
  INCLUDE (drink_type, volume_ml, price_paid_cents, tip_cents, tent_id, recorded_at);
