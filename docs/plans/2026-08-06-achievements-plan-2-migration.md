# Achievements Revamp — Plan 2: Registry Migration & Backfill

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed the 90 new achievement definitions into the registry, remap all 403 existing unlocks onto them without any user losing a badge, populate competitive standings for concluded festivals, and backfill every achievement users have genuinely earned but never received.

**Architecture:** Four ordered operations against production. (1) The existing `sync:achievements` script projects the 90 TS definitions into `achievements`. (2) A migration repoints `user_achievements.achievement_id` from the 41 legacy rows onto their new slugs via an explicit committed mapping table, deduping tier collisions onto the `user_achievements_unique` constraint and keeping the earliest `unlocked_at`, then deletes the legacy rows. (3) A migration runs `refresh_festival_group_standings` across the 5 concluded festivals so competitive metrics have data. (4) A backfill script walks every `(user, festival)` pair, calls `get_achievement_metrics`, runs the pure `evaluate()`, inserts missing unlocks, and stamps the resulting outbox events as notified so no push ever fires.

**Tech Stack:** TypeScript 5.9, Postgres 15.8 (Supabase), Vitest 4, pnpm workspaces, Turborepo, `@supabase/supabase-js`.

**Stop-and-ask protocol:** If at any step you encounter state that contradicts the plan — file missing, function signature differs, test passes when expected to fail, unfamiliar code in target lines, dependency version unavailable, or any expectation in this plan does not match reality — STOP. Do not improvise, do not work around it, do not pick the closest interpretation. Report the discrepancy and wait for guidance.

---

## Global Constraints

- Never commit directly to `main`. This plan's work belongs on branch `feat/achievements-plan-2-migration`, which already exists and is checked out.
- Do not push to the remote unless explicitly asked.
- Before any commit, `pnpm lint` and `pnpm type-check` must pass with no errors. The pre-commit hook enforces this.
- Commit message titles: **maximum 72 characters**, valid conventional-commit format. Comma-separated scopes like `fix(api,db):` are rejected by the hook.
- During development apply migration SQL with the Supabase MCP `execute_sql` tool against the **local** instance. Do **not** run `pnpm sup:db:reset`; it wipes other agents' migrations on the shared local instance.
- Generate every migration filename with `pnpm sup:mig:new <name>`. Never hand-write a timestamp.
- All new SQL functions use `SECURITY DEFINER`, `SET search_path = public`, an explicit `REVOKE EXECUTE ... FROM PUBLIC, anon`, and a narrow `GRANT`.
- Never use `defaultValue` in `t()` calls. This plan should not touch translations at all.
- **Never run any write operation against production.** Every production step in this plan is marked `[HUMAN]`.

---

## Open Questions Resolved

- **Question:** The design (§10 step 3) says backfilled rows are inserted with `source='backfill'` and both `user_notified_at`/`group_notified_at` pre-stamped. Neither column exists on `user_achievements`, and there is no `source` column.
  **Decision:** No schema change. `user_achievements` columns are exactly `id, user_id, achievement_id, festival_id, unlocked_at, progress`. The notified columns live on `achievement_events`, which the `trg_user_achievements_insert_event` AFTER INSERT trigger populates with NULL stamps. The backfill script therefore stamps `achievement_events` **after** inserting, as its own final step.
  **Why:** Verified against the live production schema on 2026-08-06. Adding a `source` column would be a schema change serving one script run.
  **If wrong:** STOP and ask.

- **Question:** Won't the backfill fire a notification storm, as the design warned (~2000 pushes at 51 users)?
  **Decision:** Two independent guards, and we rely on the explicit one. Plan 1 already added a mute in `apps/web/app/api/cron/scheduler/achievements.ts`: events whose achievement has a non-null `slug` are marked notified **without** sending. Every achievement after this plan has a slug, so the storm is already structurally impossible. **However, Plan 3 removes that mute when real copy ships.** The backfill must therefore not leave thousands of unnotified events lying around waiting for that removal. The script explicitly stamps every unnotified event at the end of its run.
  **Why:** Depending on the mute alone creates a time bomb that detonates in Plan 3.
  **If wrong:** STOP and ask.

- **Question:** What happens to the 403 existing `achievement_events` rows, all of which are currently unnotified?
  **Decision:** They are cascade-deleted. `achievement_events_achievement_id_fkey` is `ON DELETE CASCADE`, so deleting the 41 legacy achievement rows removes their events. This is correct: they are outbox entries for achievements that no longer exist, and they were never notified.
  **Why:** `achievement_events` is an outbox, not an audit log. Leaving 403 orphan-intent events pending is the storm we are trying to avoid.
  **If wrong:** STOP and ask.

- **Question:** Does the remap fire the event trigger and create spurious unlock events?
  **Decision:** No. `trg_user_achievements_insert_event` is `AFTER INSERT` only. The remap is an `UPDATE` of `achievement_id`/`festival_id`, so it creates no events.
  **Why:** Verified via `pg_get_triggerdef` on 2026-08-06.
  **If wrong:** STOP and ask. If the trigger has gained an UPDATE clause, the remap strategy needs rework.

- **Question:** Will the still-live legacy plpgsql engine mis-award against the 90 new registry rows before the follow-up cleanup PR drops it?
  **Decision:** No. `achievements.conditions` is `NOT NULL DEFAULT '{}'::jsonb`, and the sync script does not set it, so new rows get `{}`. `check_achievement_conditions` reads `conditions->>'type'`, gets NULL, falls through every `CASE`, and returns `false`. The legacy engine safely no-ops on new-registry rows.
  **Why:** Lets step 4 cleanup ship as a separate PR (user decision 4) without leaving a live mis-award hazard.
  **If wrong:** STOP and ask.

- **Question:** How is registry-sync-before-remap ordering enforced, given the sync is a script and the remap is a migration?
  **Decision:** The remap migration opens with a guard that raises an exception if fewer than 90 slugged achievements exist, naming the exact command to run. Ordering is self-enforcing rather than documented-and-hoped-for.
  **Why:** `supabase db push` and the sync script are separate operations with no built-in ordering.
  **If wrong:** STOP and ask.

- **Question:** `legendStatus` measured 50 beers **lifetime**, but the new `drinks_total` series is festival-scoped. Where does it map?
  **Decision:** `drinks_total.t3` (target 25). Both holders were queried on 2026-08-06: their best single festivals were 39 and 31 drinks, so both provably cleared t3 and neither cleared t4 (50). The backfill would grant t3 anyway, making this remap effectively confirmatory.
  **Why:** User decision 3 — round down to the highest tier provably cleared. Mapping to t4 would award a festival achievement neither user earned in any single festival.
  **If wrong:** These are 2 rows; safe to change without stopping.

- **Question:** `multiGroupChampion`'s copy says "Reach #1 in 3 different groups", but the legacy plpgsql for `category='competitive'` actually counted **group memberships** with `target_value = 2`. Its 7 unlocks reflect "joined 2+ groups", not any win.
  **Decision:** Map to `groups_joined.t2` (target 2), not to `group_wins`. What the 6 holders provably did is join two groups.
  **Why:** User decision 3. Mapping to `group_wins.t2` would hand 6 users a competitive achievement nobody earned. If they genuinely won groups, the standings population in Task 2 plus the backfill in Task 3 will grant the real `group_wins` tiers on merit.
  **If wrong:** STOP and ask — this is the one mapping that changes an achievement's category.

- **Question:** Do the 18 zero-unlock legacy achievements need individual mappings?
  **Decision:** No. All 403 unlocks belong to the 23 legacy achievements that have unlocks; the 18 others have zero rows. They are deleted outright with no user data at stake. Several (`consistencyKing`, `risingStar`, `leaderboardLegend`, `photoPerfect`, `wiesnWanderer`) have no equivalent in the new definition set at all.
  **Why:** User decision 3, confirmed by query: `dropped = 0` unlocks.
  **If wrong:** STOP and ask.

- **Question:** Should the dedication series be hidden, given it backfills to 0 for everyone?
  **Decision:** No. `user_active_days` is empty and only accumulates from now on, so `active_days.*` and `active_day_streak.*` (8 slugs) start unearned for all users. Ship them visible.
  **Why:** User decision 2 — explicitly accepted, starting from scratch there.
  **If wrong:** Safe; no code depends on this.

- **Question:** The design never said how users who have never attended a festival receive lifetime achievements.
  **Decision:** The backfill runs an extra `(user_id, NULL)` lifetime pass for every user in `profiles`, not just the 80 with attendance. `get_achievement_metrics` computes lifetime metrics independently of `p_festival_id`, so a NULL festival yields lifetime metrics with every festival metric zeroed.
  **Why:** 297 of 377 production users have never attended anything but can still hold `profile_complete` or `friends_added.*`. Enumerating only from `attendances` would silently deny them.
  **If wrong:** STOP and ask.

- **Question:** `AchievementMetricsRepository.getMetrics/getHeldSlugs/insertUnlocks` all type `festivalId` as `string`, and the generated `Database["public"]["Functions"]["get_achievement_metrics"]["Args"]` type says `p_festival_id: string` too. Does the lifetime pass need its own duplicated query logic in the script, or does the repository get widened?
  **Decision:** Widen all three repository methods to `festivalId: string | null`. Confirmed by grepping every call site (`achievement.route.ts`, `consumption.route.ts` via `achievement.service.ts`) that all pass a real festival id string today, so this is additive and backward compatible. The generated RPC `Args` type is a pre-existing inaccuracy — the SQL parameter has no `NOT NULL` constraint and the function computes lifetime metrics independently of `p_festival_id` (proven in Task 3 Step 0) — so the call site casts past it with a comment rather than regenerating the whole `packages/db/src/types.ts`, which is out of scope for this plan.
  **Why:** Reusing the existing Zod-validated `getMetrics` and the existing `insertUnlocks` upsert logic is safer than a parallel hand-rolled version in the script, and the repository is the natural owner of "how do we call `get_achievement_metrics`."
  **If wrong:** STOP and ask.

- **Question:** Is `get_achievement_metrics(user, NULL)` actually safe, or does it error / return NULLs?
  **Decision:** Safe by construction, but **unverified by execution** — the planner's database role lacked EXECUTE on the function, which is granted only to `authenticated, service_role`. Reading the function body: `fest` resolves to zero rows, `user_att` is empty because `festival_id = NULL` is never true, and `attended_every_day` evaluates to `NULL AND false` = `false` rather than NULL. Task 3 Step 0 makes the implementer prove this before writing any code.
  **If wrong:** STOP. If the RPC errors or returns NULL for any boolean key, the lifetime pass needs a different mechanism and the plan must be revised.

- **Question:** What if a user already holds the remap's target achievement via the new engine?
  **Decision:** Skip the repoint for that identity (the badge already exists) and pull the surviving row's `unlocked_at` back to the earliest legacy equivalent. The orphaned legacy row is removed by the cascade.
  **Why:** Found by dry-running the migration on 2026-08-06: local data already had 29 unlocks on new achievements and the repoint hit `duplicate key value violates unique constraint "user_achievements_unique"`. Production has zero such rows *today*, but the live engine can create one at any moment between the registry sync and the migration, so the guard is load-bearing, not defensive decoration.
  **If wrong:** STOP and ask.

- **Question:** How many rows should the remap produce?
  **Decision:** Exactly **296** from 403 legacy unlocks, with **0** dropped. 107 collapse via tier collisions (e.g. `beerRookie` + `halfwayThere` + `seriousDrinker` all map to `drinks_total.t1`).
  **Why:** Computed against production on 2026-08-06 with the exact mapping in Task 1.
  **If wrong:** STOP. A different number means the mapping or the data changed.

---

## Out of Scope

Do not do any of the following in this plan, even if the code is nearby and looks wrong:

- **Do not** drop `check_achievement_conditions`, `calculate_achievement_progress`, `evaluate_achievement_progress`, `evaluate_user_achievements`, `trigger_evaluate_achievements`, or any of its four triggers. **Follow-up PR** (user decision 4).
- **Do not** drop the `rarity` column from `achievements` or `achievement_events`. Follow-up PR.
- **Do not** remove the slug-based notification mute in `apps/web/app/api/cron/scheduler/achievements.ts`. Plan 3 owns that.
- **Do not** touch badge components, `AchievementBadge.tsx`, the emoji `iconMap`, or any achievements screen on web or mobile. Plan 3.
- **Do not** add the unlock toast, confetti, or `POST /achievements/seen`. Plan 3.
- **Do not** write achievement name/description translation copy. Plan 3.
- **Do not** change any tier target, point value, or glyph id in `definitions.ts`. Those shipped in Plan 1.
- **Do not** "fix" pre-existing lint warnings (autofocus, exhaustive-deps, no-console). They are warnings, not errors.
- Do not add features not listed in this plan, even if related code is nearby.

---

## Conventions

Follow conventions established in the files you are modifying and in `CLAUDE.md` at the repo root. Specifically:

- **Scripts:** live in `packages/api/src/scripts/`, registered in `packages/api/package.json` `scripts`, run via `tsx`. Read `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from env and throw if absent. See `sync-achievement-registry.ts` for the exact shape, including the `process.argv[1]?.endsWith(...)` guard that keeps the module importable by tests.
- **Migrations:** header comment explaining *why*, not just what. Idempotent DDL (`IF NOT EXISTS`, `DROP ... IF EXISTS` then `CREATE`). See `supabase/migrations/20260805150000_harden_security_definer_grants.sql`.
- **Imports:** type-only imports use `import type`. Path alias `@/` maps to each package's `src/`.
- **Tests:** Vitest. Despite `globals: true` in `vitest.config.ts`, every test file in this package imports `describe`/`expect`/`it` from `"vitest"` explicitly (verified 2026-08-06) — `tsc --noEmit` doesn't pick up vitest's ambient globals, so an unimported test file fails `pnpm type-check` even though `vitest run` passes it. Follow the established pattern: import explicitly. Unit tests live beside their subject as `*.test.ts`.
- **Braces:** always use braces on `if`/`else` bodies, even single-line ones.
- **Naming:** descriptive variable names. `fallbackTimerId`, not `fallback`.

### On test-first discipline

Task 3 produces application code and begins with a failing test, as it must. Tasks 1 and 2 are SQL migrations; there is no plpgsql test harness in this repo, so each ends with an **explicit verification query whose expected output is stated in the plan**. Treat a mismatch there exactly as a failing test: STOP.

---

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/<generated>_remap_legacy_achievements.sql` | The committed 23-row mapping, the repoint, and deletion of the 41 legacy rows |
| `supabase/migrations/<generated>_populate_festival_group_standings.sql` | Runs `refresh_festival_group_standings` for every concluded festival |
| `packages/api/src/scripts/backfill-achievements.ts` | Walks `(user, festival)` pairs, evaluates, inserts unlocks, stamps events |
| `packages/api/src/scripts/backfill-achievements.test.ts` | Unit tests for the pair-enumeration and stamping logic |

**Modified:**

| Path | Change |
| --- | --- |
| `packages/api/src/repositories/supabase/achievement-metrics.repository.ts` | Widen `getMetrics`/`getHeldSlugs`/`getHeldSlugsWithUnlockDates`/`insertUnlocks` to accept `festivalId: string \| null`, so the backfill's lifetime pass reuses the same tested class. See Open Questions Resolved. |
| `packages/api/package.json` | Add `backfill:achievements` script entry |

**Read but not modified:** `packages/shared/src/achievements/{definitions,evaluator,types}.ts`, `packages/api/src/scripts/sync-achievement-registry.ts`, `apps/web/app/api/cron/scheduler/achievements.ts`.

---

## The mapping (committed artifact — design §13 item 1)

All 23 legacy achievements that carry unlocks, with the decision recorded per row. Rounding is **down** to the highest tier provably cleared (user decision 3). The 18 rows not listed here have zero unlocks and are deleted outright.

| Legacy key | What it measured | Target | → New slug | Rationale |
| --- | --- | --- | --- | --- |
| `festivalNewcomer` | days attended | 1 | `days_attended.t1` | exact (t1 = 1) |
| `regular` | days attended | 3 | `days_attended.t2` | exact (t2 = 3) |
| `dedicated` | days attended | 5 | `days_attended.t2` | round down (t3 = 6) |
| `streakMaster` | consecutive days | 3 | `attendance_streak.t2` | exact (t2 = 3) |
| `earlyBird` | attended opening day | bool | `opening_day` | exact semantic match |
| `firstDrop` | first drink logged | 1 | `first_drink` | exact semantic match; **lifetime scope** |
| `beerRookie` | drinks in festival | 3 | `drinks_total.t1` | exact (t1 = 3) |
| `halfwayThere` | drinks in festival | 5 | `drinks_total.t1` | round down (t2 = 10) |
| `seriousDrinker` | drinks in festival | 8 | `drinks_total.t1` | round down (t2 = 10) |
| `doubleDigits` | drinks in festival | 10 | `drinks_total.t2` | exact (t2 = 10) |
| `beerEnthusiast` | drinks in festival | 15 | `drinks_total.t2` | round down (t3 = 25) |
| `marathonDrinker` | drinks in festival | 20 | `drinks_total.t2` | round down (t3 = 25) |
| `legendStatus` | drinks lifetime | 50 | `drinks_total.t3` | both holders peaked at 39 / 31 in one festival — cleared t3, not t4 |
| `seriousSession` | drinks in a day | 3 | `drinks_day_max.t1` | exact (t1 = 3) |
| `dailyDouble` | drinks in a day | 4 | `drinks_day_max.t1` | round down (t2 = 5) |
| `powerHour` | drinks in a day | 6 | `drinks_day_max.t2` | round down (t3 = 8) |
| `tentCurious` | distinct tents | 3 | `tents_visited.t1` | exact (t1 = 3) |
| `tentHopper` | distinct tents | 5 | `tents_visited.t1` | round down (t2 = 6) |
| `localGuide` | distinct tents | 10 | `tents_visited.t3` | exact (t3 = 10) |
| `festivalVeteran` | distinct festivals | 2 | `festivals_attended.t1` | round down (t2 = 3); **lifetime scope** |
| `groupLeader` | created a group | bool | `created_group` | exact semantic match |
| `photoEnthusiast` | photos uploaded | 10 | `photos_uploaded.t2` | exact (t2 = 10) |
| `multiGroupChampion` | groups joined (runtime truth) | 2 | `groups_joined.t2` | exact (t2 = 2); see Open Questions — copy claimed wins, runtime counted memberships |

**Deleted with zero unlocks (18):** `centuryClub`, `closingTime`, `consistencyKing`, `festivalWarrior`, `groupChampion`, `highRoller`, `leaderboardLegend`, `memoryKeeper`, `multiYearChampion`, `openingDayLegend`, `photoPerfect`, `risingStar`, `socialButterfly`, `teamPlayer`, `tentMaster`, `topContributor`, `weekendWarrior`, `wiesnWanderer`.

**Scope changes** (`festival_id` must be set to NULL and deduped across festivals): `firstDrop` → `first_drink`, `festivalVeteran` → `festivals_attended.t1`.

---

## Task 1: Remap legacy unlocks onto the new registry

**Pre-check:** Verify `achievements` has columns `slug`, `series_id`, `tier`, `scope`, and that `user_achievements_unique` exists as `UNIQUE NULLS NOT DISTINCT (user_id, achievement_id, festival_id)`. If not, STOP.

**Files:**
- Create: `supabase/migrations/<generated>_remap_legacy_achievements.sql`

**Interfaces:**
- Consumes: the 90 slugged rows produced by `pnpm --filter=@prostcounter/api sync:achievements`.
- Produces: a registry containing only slugged achievements, and `user_achievements` rows pointing exclusively at them.

- [ ] **Step 1: Generate the migration file**

```bash
pnpm sup:mig:new remap_legacy_achievements
```

- [ ] **Step 2: Write the migration**

```sql
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
-- below. 403 legacy unlocks become 296 rows.
--
-- Two mappings change scope from festival to lifetime (first_drink,
-- festivals_attended.t1). Their festival_id is set to NULL, which also merges a
-- user's per-festival duplicates into one lifetime row.
--
-- This is an UPDATE, not an INSERT, so trg_user_achievements_insert_event
-- (AFTER INSERT only) does not fire and no outbox events are created.

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

-- Deleting the legacy registry rows cascades away both the deduped loser
-- unlocks and the 403 never-notified achievement_events that referenced them.
-- Both FKs are ON DELETE CASCADE.
DELETE FROM public.achievements WHERE slug IS NULL;

DROP TABLE IF EXISTS pg_temp.remap_plan;
DROP TABLE IF EXISTS pg_temp.legacy_remap;
```

- [ ] **Step 3: Apply against the local instance**

Use the Supabase MCP `execute_sql` tool. Run the registry sync against local first:

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<from `supabase status`> \
pnpm --filter=@prostcounter/api sync:achievements
```

Then apply the migration body.

- [ ] **Step 4: Verification query — expected output stated**

```sql
SELECT
  (SELECT count(*) FROM achievements)                              AS total_achievements,
  (SELECT count(*) FROM achievements WHERE slug IS NULL)           AS legacy_remaining,
  (SELECT count(*) FROM user_achievements ua
     JOIN achievements a ON a.id = ua.achievement_id
    WHERE a.slug IS NULL)                                          AS unlocks_on_legacy;
```

Expected: `total_achievements = 90`, `legacy_remaining = 0`, `unlocks_on_legacy = 0`.

On **production** the additional expectation is `SELECT count(*) FROM user_achievements` = **296**. Local seed data will differ; do not assert 296 locally.

If any value differs from the above, STOP.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_remap_legacy_achievements.sql
git commit -m "feat(db): remap legacy achievement unlocks onto slug registry"
```

---

## Task 2: Populate competitive standings for concluded festivals

**Pre-check:** Verify `public.refresh_festival_group_standings(uuid)` exists and `festival_group_standings` is empty or stale. If the function is missing, STOP.

**Files:**
- Create: `supabase/migrations/<generated>_populate_festival_group_standings.sql`

**Interfaces:**
- Consumes: `refresh_festival_group_standings(p_festival_id uuid)` from Plan 1.
- Produces: `festival_group_standings` rows for every concluded festival, which `get_achievement_metrics` reads for `group_wins` and `podium_finishes`.

This must run **before** Task 3's backfill. Without it every competitive achievement backfills to zero (user decision 1).

- [ ] **Step 1: Generate the migration file**

```bash
pnpm sup:mig:new populate_festival_group_standings
```

- [ ] **Step 2: Write the migration**

```sql
-- Materialises final group standings for every concluded festival.
--
-- get_achievement_metrics derives group_wins and podium_finishes from
-- festival_group_standings, scoped to festivals with end_date < CURRENT_DATE.
-- That table has never been populated, so without this every competitive
-- achievement would backfill to zero for every user.
--
-- refresh_festival_group_standings deletes and rebuilds per festival, so this
-- is safe to re-run.
DO $$
DECLARE
  v_festival    record;
  v_rows        integer;
  v_total_rows  integer := 0;
  v_festivals   integer := 0;
BEGIN
  FOR v_festival IN
    SELECT id, name FROM public.festivals
    WHERE end_date < CURRENT_DATE
    ORDER BY start_date
  LOOP
    SELECT public.refresh_festival_group_standings(v_festival.id) INTO v_rows;
    v_total_rows := v_total_rows + v_rows;
    v_festivals  := v_festivals + 1;
    RAISE NOTICE 'Standings for %: % rows', v_festival.name, v_rows;
  END LOOP;

  RAISE NOTICE 'Refreshed % concluded festivals, % standings rows total',
    v_festivals, v_total_rows;
END $$;
```

- [ ] **Step 3: Apply against the local instance and read the NOTICE output**

- [ ] **Step 4: Verification query — expected output stated**

```sql
SELECT
  (SELECT count(*) FROM festivals WHERE end_date < CURRENT_DATE)        AS concluded_festivals,
  (SELECT count(DISTINCT festival_id) FROM festival_group_standings)    AS festivals_with_standings,
  (SELECT count(*) FROM festival_group_standings)                       AS standings_rows,
  (SELECT count(*) FROM festival_group_standings WHERE rank = 1
     AND member_count >= 2)                                             AS competitive_wins;
```

Expected: `festivals_with_standings <= concluded_festivals` (a concluded festival with no groups legitimately contributes zero rows), `standings_rows > 0`, and `max(rank) = member_count` per group. On production `concluded_festivals` must equal **5**.

Assert the rank invariant explicitly:

```sql
SELECT festival_id, group_id, max(rank) AS max_rank, min(member_count) AS member_count
FROM festival_group_standings
GROUP BY festival_id, group_id
HAVING max(rank) <> min(member_count);
```

Expected: **zero rows**. If any row comes back, STOP.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_populate_festival_group_standings.sql
git commit -m "feat(db): populate group standings for concluded festivals"
```

---

## Task 3: Backfill script

**Pre-check:** Verify `packages/shared/src/achievements/evaluator.ts` exports `evaluate` and that `packages/api/src/repositories/supabase/achievement-metrics.repository.ts` exports a class exposing `getMetrics` and `insertUnlocks`. If the names differ, STOP — read them and report.

**Files:**
- Create: `packages/api/src/scripts/backfill-achievements.ts`
- Create: `packages/api/src/scripts/backfill-achievements.test.ts`
- Modify: `packages/api/package.json`

**Interfaces:**
- Consumes: `evaluate()` from `@prostcounter/shared/achievements`; `get_achievement_metrics` RPC; `AchievementMetricsRepository`.
- Produces: a `backfill:achievements` script with `--dry-run`.

The script must:
1. Enumerate every `(user_id, festival_id)` pair from `attendances`, **plus** one `(user_id, NULL)` lifetime pass for **every** user in `profiles` — not just those with attendance. On production only 80 of 377 users have ever attended a festival, and lifetime achievements like `profile_complete` and `friends_added.*` are earnable without attending anything. Skipping the other 297 users would silently deny them badges they hold.
2. For each pair, call `get_achievement_metrics` and run `evaluate()`.
3. Insert only unlocks the user does not already hold.
4. **After** inserting, stamp every unnotified `achievement_events` row so no push ever fires.
5. Print a per-user delta and write nothing under `--dry-run`.

- [ ] **Step 0: Prove the lifetime pass works before writing any code**

The whole lifetime-pass design rests on `get_achievement_metrics(user, NULL)` behaving. Verify it against the **local** instance as `service_role` before proceeding:

```sql
SET ROLE service_role;
SELECT jsonb_pretty(public.get_achievement_metrics(
  (SELECT id FROM profiles LIMIT 1), NULL
));
RESET ROLE;
```

Expected: a jsonb object containing all 30 metric keys, where every festival-scoped numeric key is `0`, every festival-scoped boolean key is `false` (**not** `null`), and the lifetime keys carry real values. If the call raises, or any boolean key comes back `null`, **STOP** — the lifetime pass needs redesigning and the plan is wrong.

- [ ] **Step 1: Write the failing test**

```ts
// packages/api/src/scripts/backfill-achievements.test.ts
import { describe, expect, it } from "vitest";

import { enumerateBackfillPairs, summariseDelta } from "./backfill-achievements";

describe("enumerateBackfillPairs", () => {
  it("emits one pair per attended festival plus one lifetime pass per user", () => {
    const attendanceRows = [
      { user_id: "u1", festival_id: "f1" },
      { user_id: "u1", festival_id: "f2" },
      { user_id: "u2", festival_id: "f1" },
    ];

    const pairs = enumerateBackfillPairs(attendanceRows, ["u1", "u2"]);

    expect(pairs).toEqual([
      { userId: "u1", festivalId: "f1" },
      { userId: "u1", festivalId: "f2" },
      { userId: "u2", festivalId: "f1" },
      { userId: "u1", festivalId: null },
      { userId: "u2", festivalId: null },
    ]);
  });

  it("emits a lifetime pass for users who have never attended anything", () => {
    const pairs = enumerateBackfillPairs([], ["u3"]);

    expect(pairs).toEqual([{ userId: "u3", festivalId: null }]);
  });

  it("deduplicates repeated user/festival rows", () => {
    const attendanceRows = [
      { user_id: "u1", festival_id: "f1" },
      { user_id: "u1", festival_id: "f1" },
    ];

    expect(enumerateBackfillPairs(attendanceRows, ["u1"])).toEqual([
      { userId: "u1", festivalId: "f1" },
      { userId: "u1", festivalId: null },
    ]);
  });
});

describe("summariseDelta", () => {
  it("counts new unlocks per user and totals them", () => {
    const summary = summariseDelta([
      { userId: "u1", festivalId: "f1", slugs: ["drinks_total.t1", "days_attended.t1"] },
      { userId: "u1", festivalId: "f2", slugs: ["drinks_total.t1"] },
      { userId: "u2", festivalId: "f1", slugs: [] },
    ]);

    expect(summary.totalUnlocks).toBe(3);
    expect(summary.perUser.get("u1")).toBe(3);
    expect(summary.perUser.has("u2")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
pnpm --filter=@prostcounter/api test backfill-achievements
```

Expected: FAIL — module not found / exports undefined.

- [ ] **Step 3: Implement the script**

Write `packages/api/src/scripts/backfill-achievements.ts`. Export `enumerateBackfillPairs` and `summariseDelta` as pure functions so the test above drives them, and keep `main()` behind the same `process.argv[1]?.endsWith(...)` guard used by `sync-achievement-registry.ts`.

Required behaviours, in order:
- Parse `--dry-run` from `process.argv`.
- Read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; throw if either is absent.
- Select `user_id, festival_id` from `attendances` and `id` from `profiles`, then feed both through `enumerateBackfillPairs(attendanceRows, allUserIds)`.
- For each pair: call the `get_achievement_metrics` RPC (passing `null` for the lifetime pass), run `evaluate()`, diff against the user's existing unlocks, collect the missing slugs. On the lifetime pass every festival-scoped metric reads zero or false, so only lifetime achievements can unlock — no festival achievement has a target of zero.
- Under `--dry-run`: print the per-user delta via `summariseDelta` and **return without writing**.
- Otherwise: insert the missing unlocks using upsert with `onConflict: "user_id,achievement_id,festival_id"` and `ignoreDuplicates: true`, matching `insertUnlocks` in the metrics repository.
- **Finally**, stamp the outbox so Plan 3's mute removal cannot detonate:

```ts
const stampedAt = new Date().toISOString();
const { error: stampError, count: stampedCount } = await supabase
  .from("achievement_events")
  .update({ user_notified_at: stampedAt, group_notified_at: stampedAt }, { count: "exact" })
  .or("user_notified_at.is.null,group_notified_at.is.null");

if (stampError) {
  throw new Error(`Failed to stamp achievement events: ${stampError.message}`);
}

console.log(`Stamped ${stampedCount ?? 0} achievement events as notified.`);
```

The filter matches EITHER column being null, not just `user_notified_at`. A row inserted by this script starts with both null, but the notification cron runs independently on its own schedule and can race with a long-running backfill: it could stamp `user_notified_at` on a freshly inserted row before this step runs, in which case filtering on `user_notified_at IS NULL` alone would skip that row and leave `group_notified_at` permanently NULL — exactly the push-storm risk this step exists to close.

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
pnpm --filter=@prostcounter/api test backfill-achievements
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Register the script**

Add to `packages/api/package.json` `scripts`:

```json
"backfill:achievements": "tsx src/scripts/backfill-achievements.ts"
```

- [ ] **Step 6: Dry-run against the local instance**

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<from `supabase status`> \
pnpm --filter=@prostcounter/api backfill:achievements --dry-run
```

Expected: prints a per-user delta and the line `Dry run: nothing written.` Verify with `SELECT count(*) FROM user_achievements;` before and after that the count is unchanged. If it changed, STOP.

- [ ] **Step 7: Lint, type-check, commit**

```bash
pnpm lint && pnpm type-check
git add packages/api/src/scripts/backfill-achievements.ts \
        packages/api/src/scripts/backfill-achievements.test.ts \
        packages/api/package.json
git commit -m "feat(api): add achievements backfill script with dry-run"
```

---

## Task 4: [HUMAN] Production run

Every step here writes to the production database and must be run by a human. Do not execute any of it autonomously.

**Pre-check:** Tasks 1-3 are committed, `pnpm lint` and `pnpm type-check` pass, and the PR has been reviewed.

- [ ] **Step 1: [HUMAN] Take a production snapshot**

Confirm a recent backup exists in the Supabase dashboard before writing anything.

- [ ] **Step 2: [HUMAN] Sync the registry to production**

```bash
SUPABASE_URL=https://jdmhjakxhtghsbnstyou.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<production service role key> \
pnpm --filter=@prostcounter/api sync:achievements
```

Expected: `Synced 90 achievements.` Verify `SELECT count(*) FROM achievements` returns **131** (41 legacy + 90 new) at this point.

- [ ] **Step 3: [HUMAN] Push the migrations**

```bash
pnpm sup:db:push
```

Applies Task 1's remap and Task 2's standings population. Run Task 1 Step 4 and Task 2 Step 4 verification queries against production. Expected on production: `total_achievements = 90`, `legacy_remaining = 0`, `unlocks_on_legacy = 0`, `count(*) FROM user_achievements = 296`, `concluded_festivals = 5`.

If `user_achievements` is not exactly 296, STOP and restore from the snapshot.

- [ ] **Step 4: [HUMAN] Dry-run the backfill against production**

```bash
SUPABASE_URL=https://jdmhjakxhtghsbnstyou.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<production service role key> \
pnpm --filter=@prostcounter/api backfill:achievements --dry-run
```

Review the per-user delta. Sanity checks before proceeding:
- No user should gain a `active_days.*` or `active_day_streak.*` unlock — `user_active_days` is empty, so those must all read zero (user decision 2).
- Users who held `multiGroupChampion` should gain real `group_wins.*` only if the standings actually show them at rank 1 with `member_count >= 2`.

- [ ] **Step 5: [HUMAN] Run the backfill for real**

```bash
SUPABASE_URL=https://jdmhjakxhtghsbnstyou.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<production service role key> \
pnpm --filter=@prostcounter/api backfill:achievements
```

- [ ] **Step 6: [HUMAN] Verify no notification is pending**

```sql
SELECT count(*) AS unnotified
FROM achievement_events
WHERE user_notified_at IS NULL OR group_notified_at IS NULL;
```

Expected: **0**. Checks both columns, not just `user_notified_at`: the notification cron runs independently and can race with the script, so a row can end up with only one column stamped. If non-zero, the stamping step failed — do not deploy Plan 3 until this reads zero.

- [ ] **Step 7: [HUMAN] Confirm no user lost a badge**

```sql
SELECT count(DISTINCT user_id) AS users_with_unlocks FROM user_achievements;
```

Expected: **>= 51**. The pre-migration figure was 51 users holding 403 unlocks.

---

## Follow-up (NOT this PR)

Design §10 step 4 cleanup ships separately once the above is verified in production (user decision 4): drop `check_achievement_conditions`, `calculate_achievement_progress`, `evaluate_achievement_progress`, `evaluate_user_achievements`, `trigger_evaluate_achievements` and its four triggers, and the `rarity` column.
