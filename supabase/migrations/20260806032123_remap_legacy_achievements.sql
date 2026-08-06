-- Remaps every legacy achievement unlock onto the new slug registry, then
-- deletes the 41 legacy achievement rows.
--
-- Ordering matters and is enforced, not assumed: the registry sync script must
-- have run first, because this migration resolves targets by slug.
--
-- Dedup: several legacy achievements collapse onto one new slug (beerRookie,
-- halfwayThere and seriousDrinker all become drinks_total.t1). A user holding
-- more than one would violate user_achievements_unique, so only the earliest
-- unlock survives per target identity and the rest are dropped by the cascade
-- below. On production 403 legacy unlocks become 296 rows.
--
-- Two mappings change scope from festival to lifetime (first_drink,
-- festivals_attended.t1). Their festival_id is set to NULL, which also merges a
-- user's per-festival duplicates into one lifetime row.
--
-- This is an UPDATE, not an INSERT, so trg_user_achievements_insert_event
-- (AFTER INSERT only) does not fire and no outbox events are created.
--
-- Deleting the legacy registry rows cascades away both the deduped loser
-- unlocks and the never-notified achievement_events that referenced them; both
-- FKs are ON DELETE CASCADE. That is intentional: those events are outbox
-- entries for achievements that no longer exist and were never sent.

DO $$
DECLARE
  v_slugged integer;
BEGIN
  SELECT count(*) INTO v_slugged FROM public.achievements WHERE slug IS NOT NULL;
  IF v_slugged < 90 THEN
    RAISE EXCEPTION
      'Registry not synced: found % slugged achievements, expected >= 90. Run: pnpm --filter=@prostcounter/api sync:achievements',
      v_slugged;
  END IF;
END $$;

-- Scratch tables are session-scoped, not ON COMMIT DROP: applied outside an
-- explicit transaction psql autocommits each statement, which would drop them
-- the instant they were created. Dropped explicitly at the end instead.
DROP TABLE IF EXISTS pg_temp.legacy_remap;
DROP TABLE IF EXISTS pg_temp.remap_plan;

CREATE TEMP TABLE legacy_remap (
  legacy_key text PRIMARY KEY,
  new_slug   text NOT NULL,
  new_scope  text NOT NULL CHECK (new_scope IN ('festival', 'lifetime'))
);

INSERT INTO legacy_remap (legacy_key, new_slug, new_scope) VALUES
  ('festivalNewcomer',   'days_attended.t1',      'festival'),
  ('regular',            'days_attended.t2',      'festival'),
  ('dedicated',          'days_attended.t2',      'festival'),
  ('streakMaster',       'attendance_streak.t2',  'festival'),
  ('earlyBird',          'opening_day',           'festival'),
  ('firstDrop',          'first_drink',           'lifetime'),
  ('beerRookie',         'drinks_total.t1',       'festival'),
  ('halfwayThere',       'drinks_total.t1',       'festival'),
  ('seriousDrinker',     'drinks_total.t1',       'festival'),
  ('doubleDigits',       'drinks_total.t2',       'festival'),
  ('beerEnthusiast',     'drinks_total.t2',       'festival'),
  ('marathonDrinker',    'drinks_total.t2',       'festival'),
  ('legendStatus',       'drinks_total.t3',       'festival'),
  ('seriousSession',     'drinks_day_max.t1',     'festival'),
  ('dailyDouble',        'drinks_day_max.t1',     'festival'),
  ('powerHour',          'drinks_day_max.t2',     'festival'),
  ('tentCurious',        'tents_visited.t1',      'festival'),
  ('tentHopper',         'tents_visited.t1',      'festival'),
  ('localGuide',         'tents_visited.t3',      'festival'),
  ('festivalVeteran',    'festivals_attended.t1', 'lifetime'),
  ('groupLeader',        'created_group',         'festival'),
  ('photoEnthusiast',    'photos_uploaded.t2',    'festival'),
  ('multiGroupChampion', 'groups_joined.t2',      'festival');

-- Every mapped slug must resolve, or the mapping has drifted from definitions.ts.
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(r.new_slug, ', ') INTO v_missing
  FROM legacy_remap r
  WHERE NOT EXISTS (SELECT 1 FROM public.achievements a WHERE a.slug = r.new_slug);

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Remap targets missing from registry: %', v_missing;
  END IF;
END $$;

-- Resolve every legacy unlock to its target identity once, so the two
-- statements below read the same plan instead of recomputing the join.
CREATE TEMP TABLE remap_plan AS
SELECT
  ua.id          AS ua_id,
  ua.user_id     AS user_id,
  na.id          AS new_achievement_id,
  CASE WHEN r.new_scope = 'lifetime' THEN NULL ELSE ua.festival_id END AS new_festival_id,
  ua.unlocked_at AS unlocked_at
FROM public.user_achievements ua
JOIN public.achievements la
  ON la.id = ua.achievement_id
 AND la.slug IS NULL
JOIN legacy_remap r
  ON r.legacy_key = replace(replace(la.name, 'achievements.items.', ''), '.name', '')
JOIN public.achievements na
  ON na.slug = r.new_slug;

-- A user may ALREADY hold the target achievement via the new engine, in which
-- case the legacy row cannot be repointed onto it without violating
-- user_achievements_unique. Production has no such rows today (every unlock
-- still points at a legacy achievement), but local dev data does, and the live
-- engine can create them at any time. Pull the surviving row's unlocked_at back
-- to the earliest legacy equivalent so collapsing never costs the user their
-- original unlock date.
UPDATE public.user_achievements ua
SET unlocked_at = earliest.earliest_unlocked_at
FROM (
  SELECT user_id, new_achievement_id, new_festival_id, min(unlocked_at) AS earliest_unlocked_at
  FROM remap_plan
  GROUP BY user_id, new_achievement_id, new_festival_id
) earliest
WHERE ua.user_id        = earliest.user_id
  AND ua.achievement_id = earliest.new_achievement_id
  AND ua.festival_id IS NOT DISTINCT FROM earliest.new_festival_id
  AND ua.unlocked_at    > earliest.earliest_unlocked_at;

-- Repoint the surviving unlock for each target identity, keeping the earliest
-- and skipping identities the user already holds.
WITH winners AS (
  SELECT DISTINCT ON (user_id, new_achievement_id, new_festival_id)
    ua_id, new_achievement_id, new_festival_id
  FROM remap_plan p
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_achievements existing
    WHERE existing.user_id        = p.user_id
      AND existing.achievement_id = p.new_achievement_id
      AND existing.festival_id IS NOT DISTINCT FROM p.new_festival_id
  )
  ORDER BY user_id, new_achievement_id, new_festival_id, unlocked_at ASC, ua_id
)
UPDATE public.user_achievements ua
SET achievement_id = w.new_achievement_id,
    festival_id    = w.new_festival_id
FROM winners w
WHERE ua.id = w.ua_id;

DELETE FROM public.achievements WHERE slug IS NULL;

DROP TABLE IF EXISTS pg_temp.remap_plan;
DROP TABLE IF EXISTS pg_temp.legacy_remap;
