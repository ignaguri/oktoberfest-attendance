# Achievements Revamp — Plan 1: Engine & Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken name-matching plpgsql achievement engine with a typed TypeScript definition set, a single SQL metrics function, and a pure TypeScript evaluator, so that achievements begin unlocking correctly again.

**Architecture:** One SQL function (`get_achievement_metrics`) returns every metric for a `(user, festival)` pair as a single jsonb object. Achievement definitions live as typed TS objects in `packages/shared/src/achievements/`. A pure evaluator compares metrics to definitions and returns unlocks. An API service orchestrates: read metrics → evaluate → insert unlocks → return them in the mutation response. Evaluation moves onto the write path; the existing `achievement_events` outbox and cron notification path are untouched by this plan.

**Tech Stack:** TypeScript 5.9, Postgres 15.8 (Supabase), Hono + `@hono/zod-openapi`, Vitest 4, pnpm workspaces, Turborepo.

**Stop-and-ask protocol:** If at any step you encounter state that contradicts the plan — file missing, function signature differs, test passes when expected to fail, unfamiliar code in target lines, dependency version unavailable, or any expectation in this plan does not match reality — STOP. Do not improvise, do not work around it, do not pick the closest interpretation. Report the discrepancy and wait for guidance.

## Global Constraints

- Never commit directly to `main`. This plan's work belongs on branch `feat/achievements-revamp`, which already exists.
- Do not push to the remote unless explicitly asked.
- Before any commit, `pnpm lint` and `pnpm type-check` must pass with no errors. The pre-commit hook enforces this and will run them for you.
- Commit message titles: **maximum 72 characters**. The pre-commit hook rejects longer ones.
- Never use `defaultValue` in `t()` calls. Translation keys go in all three of `packages/shared/src/i18n/locales/{en,de,es}.json` with correct German umlauts (ä ö ü ß) and Spanish accents and inverted punctuation (á é í ó ú ñ ¿ ¡).
- Never use template literals or string concatenation for dynamic `className`. Use `cn()` from `@prostcounter/ui`.
- During development apply migration SQL with the Supabase MCP `execute_sql` tool against the local instance. Do **not** run `pnpm sup:db:reset`; it wipes other agents' migrations on the shared local instance.
- All new SQL functions use `SECURITY DEFINER` and `SET search_path = public`, matching the convention in `supabase/migrations/20260325120000_radler_half_beer_leaderboard.sql`.

---

## Open Questions Resolved

- **Question:** Does a radler count as 1 drink or 0.5 for `drinks_total`, given `20260325120000_radler_half_beer_leaderboard.sql` counts it as 0.5 on leaderboards?
  **Decision:** Achievements count **raw consumption rows**. A radler is 1 drink for `drinks_total`, `drinks_day_max` and `drink_types_distinct`. The 0.5 rule stays confined to leaderboards.
  **Why:** "Drinks logged" is what the achievement claims to measure, and fractional targets make tier ladders incoherent. `volume_ml_total` already captures the "how much did you actually drink" dimension honestly.
  **If wrong:** STOP and ask. Do not continue with a different choice.

- **Question:** Should evaluation failure fail the mutation that triggered it?
  **Decision:** No. `evaluateAndUnlock` is wrapped in try/catch inside the route handler; on error it logs and returns `unlocked: []`. Logging a drink must never 500 because the achievement engine broke.
  **Why:** Achievements are secondary to the core action. The nightly sweep (Plan 2) catches anything missed.
  **If wrong:** STOP and ask.

- **Question:** Is evaluation awaited before the mutation responds, or fire-and-forget?
  **Decision:** Awaited. The response body carries `unlocked[]`, which Plan 3's toast depends on.
  **Why:** Fire-and-forget cannot return unlocks to the client, defeating the design's unlock-moment UX.
  **If wrong:** STOP and ask.

- **Question:** The spec's "Year in Review" one-off needs a "user viewed their Wrapped" signal, which does not exist. `wrapped_data_cache` tracks generation, not viewing.
  **Decision:** Add `first_viewed_at timestamptz` to `wrapped_data_cache` in Task 1. The metric `wrapped_viewed` is `first_viewed_at IS NOT NULL`. **Setting** that column is out of scope for this plan; the metric will simply read `false` for everyone until the wrapped route is wired up in Plan 3.
  **Why:** Adding the column now avoids a second migration later. Wiring the write belongs with the presentation work.
  **If wrong:** STOP and ask.

- **Question:** Does creating a group also count toward `groups_joined`?
  **Decision:** Yes, if a `group_members` row exists for the creator. `groups_joined` counts `group_members` rows; `created_group` is a separate boolean from `groups.created_by`. No special-casing.
  **Why:** Matches what the existing app already does on group creation and keeps the metric a plain count.
  **If wrong:** STOP and ask.

- **Question:** What exactly is `profile_complete`?
  **Decision:** `username IS NOT NULL AND full_name IS NOT NULL AND avatar_url IS NOT NULL` on `profiles`.
  **Why:** These are the three fields the app's own `MissingFields` component prompts for.
  **If wrong:** STOP and ask.

- **Question:** Which timezone do day boundaries use for streaks?
  **Decision:** `attendances.date` is already a `date` column, so festival streaks need no timezone handling. For `user_active_days.day`, the middleware writes `current_date`, which is UTC on Supabase. Accepted as-is.
  **Why:** Festival streaks, the user-visible ones, are exact. A UTC boundary on app-usage streaks can only shift by hours and no achievement depends on precision there.
  **If wrong:** STOP and ask.

- **Question:** Where do achievement definitions live and how are they exported?
  **Decision:** `packages/shared/src/achievements/`, exported via a new `"./achievements": "./src/achievements/index.ts"` entry in `packages/shared/package.json` `exports`, matching the existing `"./wrapped"` pattern.
  **Why:** Consistent with every other subsystem in that package.
  **If wrong:** STOP and ask.

- **Question:** What migration filename timestamps should be used?
  **Decision:** Generate each with `pnpm sup:mig:new <name>`, which produces the correct `YYYYMMDDHHMMSS_` prefix. Never hand-write a timestamp.
  **Why:** The last migration is `20260805003427_`; a hand-written timestamp risks ordering collisions.
  **If wrong:** STOP and ask.

- **Question:** Does `get_achievement_metrics` return lifetime metrics too, or only festival-scoped ones?
  **Decision:** One call returns both. It takes `p_festival_id` for the festival-scoped half and computes lifetime metrics independently of it.
  **Why:** One round trip instead of two, and the evaluator needs both anyway to decide unlocks across scopes.
  **If wrong:** STOP and ask.

- **Question:** Does this plan change what the achievements UI renders?
  **Decision:** No. The `/achievements/with-progress` endpoint keeps its existing response shape (`{ data, stats }`) so the current web and mobile screens keep working unchanged. New fields (`series_id`, `tier`, `scope`) are added to each item but the old fields remain.
  **Why:** Plan 1 must be independently shippable. The UI revamp is Plan 3.
  **If wrong:** STOP and ask.

- **Question:** The spec did not say how progress percentage is calculated within a series.
  **Decision:** Progress is measured **from the last tier cleared**, not from zero. At 5 drinks with tiers at 3 and 10, the bar reads 29% (2 of the 7 between them), not 50% (5 of 10).
  **Why:** Measuring from zero makes the bar creep asymptotically and barely move after the first tier. Restarting on each unlock keeps every rung feeling reachable, which is the whole point of the "Close to unlocking" rail in Plan 3.
  **If wrong:** STOP and ask. The evaluator tests encode this exact arithmetic.

- **Question:** The spec did not specify how concurrent evaluations avoid double-inserting unlocks.
  **Decision:** `insertUnlocks` uses `upsert` with `onConflict: "user_id,achievement_id,festival_id"` and `ignoreDuplicates: true`, relying on the `user_achievements_unique` constraint from Task 1.
  **Why:** Two simultaneous mutations can both evaluate before either inserts. The constraint makes the race harmless, and ignoring duplicates is cheaper than locking.
  **If wrong:** STOP and ask.

- **Question:** The spec said activity is written "fire-and-forget from the API auth middleware" but not whether it writes the table directly.
  **Decision:** It calls a `SECURITY DEFINER` RPC, `record_user_active_day`, which asserts `auth.uid() = p_user_id`. No INSERT policy is added to `user_active_days`.
  **Why:** An INSERT policy would let any authenticated client write arbitrary activity rows, corrupting both the achievement metric and the BI data. The RPC keeps the write path narrow.
  **If wrong:** STOP and ask.

- **Question:** The spec called for a `platform` and `app_version` column but did not say how the API learns them.
  **Decision:** Two request headers, `X-Client-Platform` and `X-Client-Version`, read in the middleware. **Neither client sends them yet**, so both columns will be NULL until a follow-up wires them up. The table and metric work regardless.
  **Why:** Headers are the least invasive channel and cost nothing when absent. Making the clients send them is not required by any achievement in this plan.
  **If wrong:** STOP and ask.

- **Question:** The existing UI renders achievements by `rarity`, which D6 retires — but Plan 2 is what drops the column.
  **Decision:** A `tierToRarity()` bridge function in `achievement.route.ts` maps tier 1-4 onto common/rare/epic/legendary for the response only. Nothing is written to the database using it. It is deleted in Plan 3.
  **Why:** Keeps Plan 1 independently shippable without touching UI code.
  **If wrong:** STOP and ask.

- **Question:** The spec listed tier targets but not point values for every rung, nor glyph identifiers.
  **Decision:** Point values and glyph id strings in `definitions.ts` were chosen by the planner. Points scale roughly 1x / 4x / 11x / 28x from bronze to platinum, weighted up for Competitive. Glyph ids are descriptive placeholders naming the intended artwork.
  **Why:** The plan cannot contain placeholders, so concrete values were required. Both are pure data and changing them later is a one-line edit with no migration.
  **If wrong:** These are safe to tune without stopping — they are the one part of this plan where a different choice breaks nothing. Tier *targets*, by contrast, come from the approved spec: do not change those.

---

## Out of Scope

Do not do any of the following in this plan, even if the code is nearby and looks wrong:

- **Do not** drop `check_achievement_conditions`, `calculate_achievement_progress`, `evaluate_achievement_progress`, `evaluate_user_achievements`, `trigger_evaluate_achievements`, or any of its four triggers. They stay live until Plan 2. They will co-exist with the new engine and that is intentional.
- **Do not** drop the `rarity` column from `achievements` or `achievement_events`. Plan 2.
- **Do not** remap or backfill existing `user_achievements` rows. Plan 2.
- **Do not** touch the badge components, `AchievementBadge.tsx`, the emoji `iconMap`, or any achievements screen on web or mobile. Plan 3.
- **Do not** add the unlock toast, confetti, or the `POST /achievements/seen` endpoint. Plan 3.
- **Do not** build the SVG glyph system. Plan 3.
- **Do not** write the achievement name/description translation copy. Plan 3 ships the UI that displays it; this plan only needs slugs.
- **Do not** "fix" the unrelated lint warnings that `pnpm lint` prints (autofocus, exhaustive-deps, no-console). They are pre-existing warnings, not errors, and the build passes with them.
- Do not add features not listed in this plan, even if related code is nearby.

---

## Conventions

Follow conventions established in the files you are modifying and in `CLAUDE.md` at the repo root. Specifically:

- **Repositories:** class-based, constructor takes `SupabaseClient<Database>`, throw `DatabaseError` from `../../middleware/error` on failure. See `packages/api/src/repositories/supabase/consumption.repository.ts`.
- **Services:** class-based, constructor takes repositories. See `packages/api/src/services/consumption.service.ts`.
- **Routes:** `createRoute` + `app.openapi(...)` from `@hono/zod-openapi`. See `packages/api/src/routes/consumption.route.ts`.
- **Schemas:** Zod v4 in `packages/shared/src/schemas/`, re-exported from `packages/shared/src/schemas/index.ts`.
- **Imports:** type-only imports use `import type`. Path alias `@/` maps to each package's `src/`.
- **Tests:** Vitest with `globals: true`, so `describe`/`it`/`expect` need no import. Unit tests live in `src/**/*.test.ts`; integration tests are `*.integration.test.ts` and are excluded from the default run.
- **Braces:** always use braces on `if`/`else` bodies, even single-line ones.
- **Naming:** descriptive variable names. `fallbackTimerId`, not `fallback`.

### On test-first discipline

Tasks 3, 4, 7 and 10 produce application code and each begins with a failing test, as they must.

Tasks 1, 5, 6, 8 and 9 are primarily SQL migrations and type declarations. There is no unit-test harness for plpgsql in this repo, so each of those tasks instead ends with an **explicit verification query whose expected output is stated in the plan**. Treat a mismatch there exactly as you would a failing test: STOP. Do not proceed on the assumption it will sort itself out later.

Task 2 declares types only and produces no runtime behaviour; Tasks 3 and 4 test everything built on it.

---

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `packages/shared/src/achievements/types.ts` | `AchievementMetrics`, `MetricKey`, category/scope/tier types, definition interfaces |
| `packages/shared/src/achievements/definitions.ts` | The 20 series and 10 one-offs as data |
| `packages/shared/src/achievements/evaluator.ts` | Pure `evaluate()` function |
| `packages/shared/src/achievements/index.ts` | Barrel export |
| `packages/shared/src/achievements/definitions.test.ts` | Integrity tests over the definition set |
| `packages/shared/src/achievements/evaluator.test.ts` | Behavioural tests for the evaluator |
| `packages/api/src/services/achievement.service.ts` | Orchestration: metrics → evaluate → persist |
| `packages/api/src/services/__tests__/achievement.service.test.ts` | Service tests with a mocked repository |
| `packages/api/src/repositories/supabase/achievement-metrics.repository.ts` | Wraps the `get_achievement_metrics` RPC and unlock inserts |
| `supabase/migrations/<generated>_achievements_engine_schema.sql` | Task 1 schema |
| `supabase/migrations/<generated>_achievement_metrics_function.sql` | Task 5 function |
| `supabase/migrations/<generated>_festival_group_standings_refresh.sql` | Task 6 function |

**Modified:**

| Path | Change |
| --- | --- |
| `packages/shared/package.json` | Add `"./achievements"` export |
| `packages/api/src/middleware/auth.ts` | Fire-and-forget `user_active_days` upsert |
| `packages/api/src/routes/consumption.route.ts:91-105` | Await evaluation, return `unlocked[]` |
| `packages/api/src/routes/achievement.route.ts:185-267` | Serve with-progress from the new engine |
| `packages/api/src/repositories/supabase/achievement.repository.ts:28` | Fix `condition` → remove (column does not exist) |
| `packages/db/src/types.ts` | Regenerated after each migration |

---

## Task 1: Schema foundation

**Files:**
- Create: `supabase/migrations/<generated>_achievements_engine_schema.sql`
- Modify: `packages/db/src/types.ts` (regenerated, do not hand-edit)

**Interfaces:**
- Consumes: nothing.
- Produces: columns `achievements.slug`, `achievements.series_id`, `achievements.tier`, `achievements.scope`; nullable `user_achievements.festival_id`; tables `user_active_days`, `festival_group_standings`; column `wrapped_data_cache.first_viewed_at`.

This task is additive only. Nothing is dropped. The old engine keeps running.

- [ ] **Step 1: Generate the migration file**

```bash
pnpm sup:mig:new achievements_engine_schema
```

Note the generated filename. Every reference below to `<generated>` means that exact file.

- [ ] **Step 2: Write the migration**

Paste this into the generated file:

```sql
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
```

- [ ] **Step 3: Apply it to the local database**

Use the Supabase MCP tool `mcp__supabase-local__execute_sql`, passing the entire contents of the migration file as the `query` argument.

Do **not** run `pnpm sup:db:reset`.

- [ ] **Step 4: Verify the schema landed**

Run via `mcp__supabase-local__execute_sql`:

```sql
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name='achievements'
       AND column_name IN ('slug','series_id','tier','scope')) AS achievement_cols,
  (SELECT is_nullable FROM information_schema.columns
     WHERE table_name='user_achievements' AND column_name='festival_id') AS festival_nullable,
  (SELECT to_regclass('public.user_active_days')::text)         AS active_days,
  (SELECT to_regclass('public.festival_group_standings')::text) AS standings;
```

Expected: `achievement_cols = 4`, `festival_nullable = YES`, `active_days = user_active_days`, `standings = festival_group_standings`.

If any value differs, STOP.

- [ ] **Step 5: Regenerate database types**

```bash
pnpm sup:db:types
```

This overwrites `packages/db/src/types.ts`. Do not hand-edit that file.

- [ ] **Step 6: Type-check**

```bash
pnpm type-check
```

Expected: all 7 packages pass. If `user_achievements.festival_id` becoming nullable breaks existing call sites, STOP and report which ones — do not silently add non-null assertions.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations packages/db/src/types.ts
git commit -m "feat(db): achievements engine schema foundation"
```

---

## Task 2: Metric and definition types

**Files:**
- Create: `packages/shared/src/achievements/types.ts`
- Modify: `packages/shared/package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `AchievementMetrics` (30 keys), `MetricKey`, `BooleanMetricKey`, `NumericMetricKey`, `AchievementCategory`, `AchievementScope`, `AchievementTier`, `TierDef`, `AchievementSeries`, `AchievementOneOff`, `AchievementDefinition`, `UnlockedAchievement`, `SeriesProgress`.

There is no test step in this task: it declares types only and produces no runtime behaviour. Task 3 and Task 4 test everything built on it.

- [ ] **Step 1: Create the types file**

```ts
// packages/shared/src/achievements/types.ts

/** The six categories, organised by what the user did. */
export type AchievementCategory =
  | "drinking"
  | "attendance"
  | "explorer"
  | "social"
  | "competitive"
  | "dedication";

/** Festival-scoped achievements re-earn each festival; lifetime ones unlock once. */
export type AchievementScope = "festival" | "lifetime";

/** 1 = bronze, 2 = silver, 3 = gold, 4 = platinum. */
export type AchievementTier = 1 | 2 | 3 | 4;

export const TIER_NAMES = {
  1: "bronze",
  2: "silver",
  3: "gold",
  4: "platinum",
} as const satisfies Record<AchievementTier, string>;

/**
 * Every metric returned by the SQL function get_achievement_metrics.
 * Numeric metrics are counts or summed amounts; boolean metrics are one-shot facts.
 * Adding a key here without adding it to the SQL function will produce metrics
 * of 0/false at runtime, so the two must be changed together.
 */
export interface AchievementMetrics {
  // --- festival-scoped, numeric ---
  drinks_total: number;
  drinks_day_max: number;
  drink_types_distinct: number;
  volume_ml_total: number;
  tip_cents_total: number;
  spend_cents_total: number;
  days_attended: number;
  attendance_streak_max: number;
  tents_distinct: number;
  groups_joined: number;
  photos_uploaded: number;
  reactions_given: number;
  crowd_reports: number;

  // --- lifetime, numeric ---
  festivals_attended: number;
  festival_types_distinct: number;
  friends_accepted: number;
  group_wins: number;
  podium_finishes: number;
  active_days_total: number;
  active_day_streak_max: number;

  // --- festival-scoped, boolean ---
  attended_opening_day: boolean;
  attended_closing_day: boolean;
  attended_every_day: boolean;
  attended_every_weekend_day: boolean;
  visited_all_large_tents: boolean;
  created_group: boolean;

  // --- lifetime, boolean ---
  logged_first_drink: boolean;
  uploaded_first_photo: boolean;
  profile_complete: boolean;
  wrapped_viewed: boolean;
}

export type MetricKey = keyof AchievementMetrics;

export type NumericMetricKey = {
  [K in MetricKey]: AchievementMetrics[K] extends number ? K : never;
}[MetricKey];

export type BooleanMetricKey = {
  [K in MetricKey]: AchievementMetrics[K] extends boolean ? K : never;
}[MetricKey];

export interface TierDef {
  tier: AchievementTier;
  /** Value of the series metric at which this tier unlocks. */
  target: number;
  points: number;
}

export interface AchievementSeries {
  /** Stable identifier, also the i18n key root and the DB series_id. */
  id: string;
  category: AchievementCategory;
  scope: AchievementScope;
  metric: NumericMetricKey;
  /** Glyph identifier. Plan 3 supplies the artwork; this is just a string here. */
  glyph: string;
  tiers: [TierDef, TierDef, TierDef, TierDef];
}

export interface AchievementOneOff {
  id: string;
  category: AchievementCategory;
  scope: AchievementScope;
  metric: BooleanMetricKey;
  /** Difficulty, which drives the badge frame. Not a position in a ladder. */
  tier: AchievementTier;
  glyph: string;
  points: number;
}

export type AchievementDefinition = AchievementSeries | AchievementOneOff;

/** Narrowing helper: series have tiers, one-offs do not. */
export function isSeries(def: AchievementDefinition): def is AchievementSeries {
  return "tiers" in def;
}

/** The DB slug for a given definition and tier. Series: "drinks_total.t3". One-off: its id. */
export function slugFor(def: AchievementDefinition, tier?: AchievementTier): string {
  if (isSeries(def)) {
    if (tier === undefined) {
      throw new Error(`slugFor requires a tier for series "${def.id}"`);
    }
    return `${def.id}.t${tier}`;
  }
  return def.id;
}

export interface UnlockedAchievement {
  slug: string;
  seriesId: string | null;
  tier: AchievementTier;
  category: AchievementCategory;
  scope: AchievementScope;
  glyph: string;
  points: number;
}

export interface SeriesProgress {
  seriesId: string;
  category: AchievementCategory;
  scope: AchievementScope;
  glyph: string;
  /** Highest tier reached, or 0 if none. */
  currentTier: number;
  /** The next tier's target, or null once platinum is reached. */
  nextTarget: number | null;
  currentValue: number;
  /** 0-100, capped. 100 once platinum is reached. */
  percentage: number;
}
```

- [ ] **Step 2: Add the package export**

In `packages/shared/package.json`, inside the `"exports"` object, add this entry immediately after the `"./wrapped"` line:

```json
    "./achievements": "./src/achievements/index.ts"
```

Remember to add a comma to the preceding `"./wrapped"` line if it is not already the case that a following entry exists.

- [ ] **Step 3: Type-check**

```bash
pnpm type-check --filter=@prostcounter/shared
```

Expected: PASS. The file has no imports and declares types only.

If it fails with "Cannot find module", the barrel `index.ts` does not exist yet — that is expected and comes in Task 3. The `exports` entry pointing at a not-yet-created file does not break `tsc --noEmit` on its own. If `tsc` reports an error inside `types.ts` itself, STOP.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/achievements/types.ts packages/shared/package.json
git commit -m "feat(shared): achievement metric and definition types"
```

---

## Task 3: The definition set

**Files:**
- Create: `packages/shared/src/achievements/definitions.ts`
- Create: `packages/shared/src/achievements/index.ts`
- Create: `packages/shared/src/achievements/definitions.test.ts`

**Interfaces:**
- Consumes: everything from `./types`.
- Produces: `SERIES: AchievementSeries[]` (20 entries), `ONE_OFFS: AchievementOneOff[]` (10 entries), `ALL_DEFINITIONS: AchievementDefinition[]`, `ALL_SLUGS: string[]` (90 entries).

The integrity test comes first. It is the safety net that would have caught the original outage: it fails loudly if any definition references a metric that does not exist or if tier targets are not strictly increasing.

- [ ] **Step 1: Write the failing integrity test**

```ts
// packages/shared/src/achievements/definitions.test.ts
import { ALL_DEFINITIONS, ALL_SLUGS, ONE_OFFS, SERIES } from "./definitions";
import { isSeries, slugFor } from "./types";
import type { AchievementMetrics } from "./types";

/**
 * A zero-valued instance of AchievementMetrics. Its keys are the source of
 * truth for which metrics exist. If a definition names a metric absent here,
 * the SQL function will never supply it and the achievement is unreachable —
 * which is exactly how the previous engine died.
 */
const METRIC_KEYS: Array<keyof AchievementMetrics> = [
  "drinks_total",
  "drinks_day_max",
  "drink_types_distinct",
  "volume_ml_total",
  "tip_cents_total",
  "spend_cents_total",
  "days_attended",
  "attendance_streak_max",
  "tents_distinct",
  "groups_joined",
  "photos_uploaded",
  "reactions_given",
  "crowd_reports",
  "festivals_attended",
  "festival_types_distinct",
  "friends_accepted",
  "group_wins",
  "podium_finishes",
  "active_days_total",
  "active_day_streak_max",
  "attended_opening_day",
  "attended_closing_day",
  "attended_every_day",
  "attended_every_weekend_day",
  "visited_all_large_tents",
  "created_group",
  "logged_first_drink",
  "uploaded_first_photo",
  "profile_complete",
  "wrapped_viewed",
];

describe("achievement definitions", () => {
  it("has 20 series and 10 one-offs", () => {
    expect(SERIES).toHaveLength(20);
    expect(ONE_OFFS).toHaveLength(10);
    expect(ALL_DEFINITIONS).toHaveLength(30);
  });

  it("produces 90 unlockable slugs", () => {
    expect(ALL_SLUGS).toHaveLength(90);
  });

  it("has no duplicate definition ids", () => {
    const ids = ALL_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate slugs", () => {
    expect(new Set(ALL_SLUGS).size).toBe(ALL_SLUGS.length);
  });

  it("references only metrics that exist", () => {
    for (const def of ALL_DEFINITIONS) {
      expect(METRIC_KEYS).toContain(def.metric);
    }
  });

  it("gives every series exactly four tiers numbered 1..4", () => {
    for (const series of SERIES) {
      expect(series.tiers).toHaveLength(4);
      expect(series.tiers.map((t) => t.tier)).toEqual([1, 2, 3, 4]);
    }
  });

  it("has strictly increasing targets within each series", () => {
    for (const series of SERIES) {
      const targets = series.tiers.map((t) => t.target);
      for (let i = 1; i < targets.length; i++) {
        expect(targets[i]).toBeGreaterThan(targets[i - 1]);
      }
    }
  });

  it("has strictly increasing points within each series", () => {
    for (const series of SERIES) {
      const points = series.tiers.map((t) => t.points);
      for (let i = 1; i < points.length; i++) {
        expect(points[i]).toBeGreaterThan(points[i - 1]);
      }
    }
  });

  it("assigns every definition a non-empty glyph", () => {
    for (const def of ALL_DEFINITIONS) {
      expect(def.glyph.length).toBeGreaterThan(0);
    }
  });

  it("covers all six categories", () => {
    const categories = new Set(ALL_DEFINITIONS.map((d) => d.category));
    expect([...categories].sort()).toEqual([
      "attendance",
      "competitive",
      "dedication",
      "drinking",
      "explorer",
      "social",
    ]);
  });

  it("builds series slugs as <id>.t<tier> and one-off slugs as <id>", () => {
    const series = SERIES[0];
    expect(slugFor(series, 3)).toBe(`${series.id}.t3`);
    expect(slugFor(ONE_OFFS[0])).toBe(ONE_OFFS[0].id);
  });

  it("narrows series and one-offs correctly", () => {
    expect(SERIES.every(isSeries)).toBe(true);
    expect(ONE_OFFS.some(isSeries)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter=@prostcounter/shared test -- definitions
```

Expected: FAIL with a module resolution error, `Cannot find module './definitions'`.

- [ ] **Step 3: Write the definitions**

```ts
// packages/shared/src/achievements/definitions.ts
import type { AchievementDefinition, AchievementOneOff, AchievementSeries } from "./types";
import { isSeries, slugFor } from "./types";

/**
 * Tiered series. Each measures one numeric metric across four rungs.
 * Targets are judgement calls pending validation against the Oktoberfest 2025
 * distribution (see the design doc, §13 item 2).
 */
export const SERIES: AchievementSeries[] = [
  // ---------------------------------------------------------------- drinking
  {
    id: "drinks_total",
    category: "drinking",
    scope: "festival",
    metric: "drinks_total",
    glyph: "masskrug",
    tiers: [
      { tier: 1, target: 3, points: 10 },
      { tier: 2, target: 10, points: 50 },
      { tier: 3, target: 25, points: 150 },
      { tier: 4, target: 50, points: 400 },
    ],
  },
  {
    id: "drinks_day_max",
    category: "drinking",
    scope: "festival",
    metric: "drinks_day_max",
    glyph: "sunburst-stein",
    tiers: [
      { tier: 1, target: 3, points: 15 },
      { tier: 2, target: 5, points: 60 },
      { tier: 3, target: 8, points: 160 },
      { tier: 4, target: 12, points: 420 },
    ],
  },
  {
    id: "drink_variety",
    category: "drinking",
    scope: "festival",
    metric: "drink_types_distinct",
    glyph: "three-glasses",
    tiers: [
      { tier: 1, target: 2, points: 10 },
      { tier: 2, target: 3, points: 45 },
      { tier: 3, target: 4, points: 120 },
      { tier: 4, target: 5, points: 300 },
    ],
  },
  {
    id: "volume_total",
    category: "drinking",
    scope: "festival",
    metric: "volume_ml_total",
    glyph: "measuring-jug",
    tiers: [
      { tier: 1, target: 5_000, points: 10 },
      { tier: 2, target: 20_000, points: 55 },
      { tier: 3, target: 50_000, points: 150 },
      { tier: 4, target: 100_000, points: 400 },
    ],
  },
  {
    id: "tips_total",
    category: "drinking",
    scope: "festival",
    metric: "tip_cents_total",
    glyph: "coin-hand",
    tiers: [
      { tier: 1, target: 500, points: 15 },
      { tier: 2, target: 2_000, points: 60 },
      { tier: 3, target: 5_000, points: 150 },
      { tier: 4, target: 10_000, points: 380 },
    ],
  },
  {
    id: "spend_total",
    category: "drinking",
    scope: "festival",
    metric: "spend_cents_total",
    glyph: "purse",
    tiers: [
      { tier: 1, target: 10_000, points: 15 },
      { tier: 2, target: 30_000, points: 65 },
      { tier: 3, target: 60_000, points: 170 },
      { tier: 4, target: 100_000, points: 450 },
    ],
  },

  // -------------------------------------------------------------- attendance
  {
    id: "days_attended",
    category: "attendance",
    scope: "festival",
    metric: "days_attended",
    glyph: "calendar-check",
    tiers: [
      { tier: 1, target: 1, points: 10 },
      { tier: 2, target: 3, points: 50 },
      { tier: 3, target: 6, points: 150 },
      { tier: 4, target: 10, points: 400 },
    ],
  },
  {
    id: "attendance_streak",
    category: "attendance",
    scope: "festival",
    metric: "attendance_streak_max",
    glyph: "chain-links",
    tiers: [
      { tier: 1, target: 2, points: 20 },
      { tier: 2, target: 3, points: 70 },
      { tier: 3, target: 5, points: 180 },
      { tier: 4, target: 7, points: 450 },
    ],
  },

  // ---------------------------------------------------------------- explorer
  {
    id: "tents_visited",
    category: "explorer",
    scope: "festival",
    metric: "tents_distinct",
    glyph: "tent-peaks",
    tiers: [
      { tier: 1, target: 3, points: 15 },
      { tier: 2, target: 6, points: 60 },
      { tier: 3, target: 10, points: 160 },
      { tier: 4, target: 15, points: 400 },
    ],
  },
  {
    id: "festivals_attended",
    category: "explorer",
    scope: "lifetime",
    metric: "festivals_attended",
    glyph: "ferris-wheel",
    tiers: [
      { tier: 1, target: 1, points: 20 },
      { tier: 2, target: 3, points: 90 },
      { tier: 3, target: 5, points: 220 },
      { tier: 4, target: 8, points: 500 },
    ],
  },
  {
    id: "festival_types",
    category: "explorer",
    scope: "lifetime",
    metric: "festival_types_distinct",
    glyph: "compass-rose",
    tiers: [
      { tier: 1, target: 1, points: 15 },
      { tier: 2, target: 2, points: 70 },
      { tier: 3, target: 3, points: 190 },
      { tier: 4, target: 4, points: 450 },
    ],
  },

  // ------------------------------------------------------------------ social
  {
    id: "groups_joined",
    category: "social",
    scope: "festival",
    metric: "groups_joined",
    glyph: "three-figures",
    tiers: [
      { tier: 1, target: 1, points: 15 },
      { tier: 2, target: 2, points: 55 },
      { tier: 3, target: 4, points: 150 },
      { tier: 4, target: 6, points: 380 },
    ],
  },
  {
    id: "friends_added",
    category: "social",
    scope: "lifetime",
    metric: "friends_accepted",
    glyph: "clasped-hands",
    tiers: [
      { tier: 1, target: 1, points: 15 },
      { tier: 2, target: 5, points: 60 },
      { tier: 3, target: 15, points: 170 },
      { tier: 4, target: 30, points: 420 },
    ],
  },
  {
    id: "photos_uploaded",
    category: "social",
    scope: "festival",
    metric: "photos_uploaded",
    glyph: "camera-shutter",
    tiers: [
      { tier: 1, target: 1, points: 10 },
      { tier: 2, target: 10, points: 55 },
      { tier: 3, target: 25, points: 155 },
      { tier: 4, target: 50, points: 400 },
    ],
  },
  {
    id: "reactions_given",
    category: "social",
    scope: "festival",
    metric: "reactions_given",
    glyph: "spark-heart",
    tiers: [
      { tier: 1, target: 5, points: 10 },
      { tier: 2, target: 25, points: 50 },
      { tier: 3, target: 75, points: 140 },
      { tier: 4, target: 150, points: 350 },
    ],
  },

  // ------------------------------------------------------------- competitive
  {
    id: "group_wins",
    category: "competitive",
    scope: "lifetime",
    metric: "group_wins",
    glyph: "laurel-cup",
    tiers: [
      { tier: 1, target: 1, points: 40 },
      { tier: 2, target: 3, points: 130 },
      { tier: 3, target: 6, points: 300 },
      { tier: 4, target: 10, points: 600 },
    ],
  },
  {
    id: "podium_finishes",
    category: "competitive",
    scope: "lifetime",
    metric: "podium_finishes",
    glyph: "podium-steps",
    tiers: [
      { tier: 1, target: 1, points: 25 },
      { tier: 2, target: 5, points: 100 },
      { tier: 3, target: 12, points: 250 },
      { tier: 4, target: 25, points: 550 },
    ],
  },

  // -------------------------------------------------------------- dedication
  {
    id: "active_days",
    category: "dedication",
    scope: "lifetime",
    metric: "active_days_total",
    glyph: "hourglass",
    tiers: [
      { tier: 1, target: 5, points: 10 },
      { tier: 2, target: 25, points: 50 },
      { tier: 3, target: 75, points: 150 },
      { tier: 4, target: 200, points: 400 },
    ],
  },
  {
    id: "active_day_streak",
    category: "dedication",
    scope: "lifetime",
    metric: "active_day_streak_max",
    glyph: "flame-steady",
    tiers: [
      { tier: 1, target: 3, points: 15 },
      { tier: 2, target: 7, points: 65 },
      { tier: 3, target: 21, points: 180 },
      { tier: 4, target: 60, points: 480 },
    ],
  },
  {
    id: "crowd_reports",
    category: "dedication",
    scope: "festival",
    metric: "crowd_reports",
    glyph: "signal-flag",
    tiers: [
      { tier: 1, target: 1, points: 10 },
      { tier: 2, target: 5, points: 45 },
      { tier: 3, target: 15, points: 130 },
      { tier: 4, target: 30, points: 330 },
    ],
  },
];

/** One-shot achievements. Their tier encodes difficulty, not ladder position. */
export const ONE_OFFS: AchievementOneOff[] = [
  {
    id: "first_drink",
    category: "drinking",
    scope: "lifetime",
    metric: "logged_first_drink",
    tier: 1,
    glyph: "first-drop",
    points: 10,
  },
  {
    id: "opening_day",
    category: "attendance",
    scope: "festival",
    metric: "attended_opening_day",
    tier: 2,
    glyph: "sunrise-gate",
    points: 80,
  },
  {
    id: "closing_day",
    category: "attendance",
    scope: "festival",
    metric: "attended_closing_day",
    tier: 2,
    glyph: "sunset-gate",
    points: 80,
  },
  {
    id: "every_weekend_day",
    category: "attendance",
    scope: "festival",
    metric: "attended_every_weekend_day",
    tier: 3,
    glyph: "double-sun",
    points: 220,
  },
  {
    id: "full_festival",
    category: "attendance",
    scope: "festival",
    metric: "attended_every_day",
    tier: 4,
    glyph: "wiesn-crown",
    points: 600,
  },
  {
    id: "all_large_tents",
    category: "explorer",
    scope: "festival",
    metric: "visited_all_large_tents",
    tier: 4,
    glyph: "tent-ring",
    points: 550,
  },
  {
    id: "first_photo",
    category: "social",
    scope: "lifetime",
    metric: "uploaded_first_photo",
    tier: 1,
    glyph: "polaroid",
    points: 10,
  },
  {
    id: "created_group",
    category: "social",
    scope: "festival",
    metric: "created_group",
    tier: 2,
    glyph: "banner-pole",
    points: 70,
  },
  {
    id: "profile_complete",
    category: "dedication",
    scope: "lifetime",
    metric: "profile_complete",
    tier: 1,
    glyph: "id-card",
    points: 15,
  },
  {
    id: "wrapped_viewed",
    category: "dedication",
    scope: "lifetime",
    metric: "wrapped_viewed",
    tier: 2,
    glyph: "ribbon-scroll",
    points: 60,
  },
];

export const ALL_DEFINITIONS: AchievementDefinition[] = [...SERIES, ...ONE_OFFS];

/** Every unlockable slug: 20 series x 4 tiers, plus 10 one-offs = 90. */
export const ALL_SLUGS: string[] = ALL_DEFINITIONS.flatMap((def) => {
  if (isSeries(def)) {
    return def.tiers.map((tierDef) => slugFor(def, tierDef.tier));
  }
  return [slugFor(def)];
});
```

- [ ] **Step 4: Write the barrel export**

```ts
// packages/shared/src/achievements/index.ts
export * from "./types";
export * from "./definitions";
```

The evaluator export is deliberately **not** added here yet. `evaluator.ts` does not exist until Task 4, and a barrel exporting a missing module fails `pnpm type-check`, which the pre-commit hook runs — so Step 6's commit would be rejected. Task 4 adds the third line.

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm --filter=@prostcounter/shared test -- definitions
```

Expected: PASS, 12 tests.

If "has 20 series and 10 one-offs" fails, you have miscounted an array — recount rather than adjusting the expected number.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/achievements/
git commit -m "feat(shared): achievement definition set with integrity tests"
```

---

## Task 4: The evaluator

**Files:**
- Create: `packages/shared/src/achievements/evaluator.ts`
- Create: `packages/shared/src/achievements/evaluator.test.ts`

**Interfaces:**
- Consumes: `AchievementMetrics`, `AchievementDefinition`, `UnlockedAchievement`, `SeriesProgress`, `isSeries`, `slugFor` from `./types`; `ALL_DEFINITIONS`, `SERIES` from `./definitions`.
- Produces: `evaluate(metrics: AchievementMetrics, alreadyUnlocked: Set<string>): EvaluationResult` where `EvaluationResult = { unlocked: UnlockedAchievement[]; progress: SeriesProgress[] }`.

This is a pure function with no I/O. It is the single most important thing to get right in this plan.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/shared/src/achievements/evaluator.test.ts
import { SERIES } from "./definitions";
import { evaluate } from "./evaluator";
import type { AchievementMetrics } from "./types";

/** All metrics at zero / false. Override only what a test cares about. */
function emptyMetrics(overrides: Partial<AchievementMetrics> = {}): AchievementMetrics {
  return {
    drinks_total: 0,
    drinks_day_max: 0,
    drink_types_distinct: 0,
    volume_ml_total: 0,
    tip_cents_total: 0,
    spend_cents_total: 0,
    days_attended: 0,
    attendance_streak_max: 0,
    tents_distinct: 0,
    groups_joined: 0,
    photos_uploaded: 0,
    reactions_given: 0,
    crowd_reports: 0,
    festivals_attended: 0,
    festival_types_distinct: 0,
    friends_accepted: 0,
    group_wins: 0,
    podium_finishes: 0,
    active_days_total: 0,
    active_day_streak_max: 0,
    attended_opening_day: false,
    attended_closing_day: false,
    attended_every_day: false,
    attended_every_weekend_day: false,
    visited_all_large_tents: false,
    created_group: false,
    logged_first_drink: false,
    uploaded_first_photo: false,
    profile_complete: false,
    wrapped_viewed: false,
    ...overrides,
  };
}

const drinksSeries = SERIES.find((s) => s.id === "drinks_total")!;

describe("evaluate — boundaries", () => {
  it("unlocks nothing at target minus one", () => {
    const result = evaluate(emptyMetrics({ drinks_total: 2 }), new Set());
    expect(result.unlocked.map((u) => u.slug)).not.toContain("drinks_total.t1");
  });

  it("unlocks exactly at target", () => {
    const result = evaluate(emptyMetrics({ drinks_total: 3 }), new Set());
    expect(result.unlocked.map((u) => u.slug)).toContain("drinks_total.t1");
  });

  it("unlocks above target", () => {
    const result = evaluate(emptyMetrics({ drinks_total: 4 }), new Set());
    expect(result.unlocked.map((u) => u.slug)).toContain("drinks_total.t1");
  });
});

describe("evaluate — tier jumping", () => {
  it("unlocks every crossed tier at once", () => {
    const result = evaluate(emptyMetrics({ drinks_total: 25 }), new Set());
    const slugs = result.unlocked.map((u) => u.slug);
    expect(slugs).toContain("drinks_total.t1");
    expect(slugs).toContain("drinks_total.t2");
    expect(slugs).toContain("drinks_total.t3");
    expect(slugs).not.toContain("drinks_total.t4");
  });

  it("unlocks all four tiers when the top target is met", () => {
    const result = evaluate(emptyMetrics({ drinks_total: 50 }), new Set());
    const slugs = result.unlocked.filter((u) => u.seriesId === "drinks_total");
    expect(slugs).toHaveLength(4);
  });
});

describe("evaluate — idempotency", () => {
  it("returns nothing already held", () => {
    const metrics = emptyMetrics({ drinks_total: 25 });
    const first = evaluate(metrics, new Set());
    const held = new Set(first.unlocked.map((u) => u.slug));
    const second = evaluate(metrics, held);
    expect(second.unlocked).toHaveLength(0);
  });

  it("is stable across repeated calls with the same held set", () => {
    const metrics = emptyMetrics({ drinks_total: 10, days_attended: 3 });
    const a = evaluate(metrics, new Set());
    const b = evaluate(metrics, new Set());
    expect(a.unlocked.map((u) => u.slug).sort()).toEqual(b.unlocked.map((u) => u.slug).sort());
  });
});

describe("evaluate — one-offs", () => {
  it("does not unlock a false boolean metric", () => {
    const result = evaluate(emptyMetrics({ attended_opening_day: false }), new Set());
    expect(result.unlocked.map((u) => u.slug)).not.toContain("opening_day");
  });

  it("unlocks a true boolean metric", () => {
    const result = evaluate(emptyMetrics({ attended_opening_day: true }), new Set());
    expect(result.unlocked.map((u) => u.slug)).toContain("opening_day");
  });

  it("reports one-offs with a null seriesId and their declared tier", () => {
    const result = evaluate(emptyMetrics({ attended_every_day: true }), new Set());
    const entry = result.unlocked.find((u) => u.slug === "full_festival");
    expect(entry).toBeDefined();
    expect(entry!.seriesId).toBeNull();
    expect(entry!.tier).toBe(4);
  });

  it("suppresses a one-off the user already holds", () => {
    const result = evaluate(
      emptyMetrics({ attended_opening_day: true }),
      new Set(["opening_day"]),
    );
    expect(result.unlocked.map((u) => u.slug)).not.toContain("opening_day");
  });
});

describe("evaluate — scope separation", () => {
  it("marks lifetime and festival unlocks with their declared scope", () => {
    const result = evaluate(
      emptyMetrics({ drinks_total: 3, friends_accepted: 1 }),
      new Set(),
    );
    const festivalUnlock = result.unlocked.find((u) => u.slug === "drinks_total.t1");
    const lifetimeUnlock = result.unlocked.find((u) => u.slug === "friends_added.t1");
    expect(festivalUnlock!.scope).toBe("festival");
    expect(lifetimeUnlock!.scope).toBe("lifetime");
  });
});

describe("evaluate — progress", () => {
  it("returns one progress entry per series", () => {
    const result = evaluate(emptyMetrics(), new Set());
    expect(result.progress).toHaveLength(SERIES.length);
  });

  it("reports currentTier 0 and the first target when nothing is earned", () => {
    const result = evaluate(emptyMetrics(), new Set());
    const entry = result.progress.find((p) => p.seriesId === "drinks_total")!;
    expect(entry.currentTier).toBe(0);
    expect(entry.nextTarget).toBe(drinksSeries.tiers[0].target);
    expect(entry.currentValue).toBe(0);
    expect(entry.percentage).toBe(0);
  });

  it("reports progress toward the next tier, not from zero", () => {
    // t1 = 3, t2 = 10. At 5 drinks the user is 2/7 of the way from t1 to t2.
    const result = evaluate(emptyMetrics({ drinks_total: 5 }), new Set());
    const entry = result.progress.find((p) => p.seriesId === "drinks_total")!;
    expect(entry.currentTier).toBe(1);
    expect(entry.nextTarget).toBe(10);
    expect(entry.percentage).toBe(29); // round(2 / 7 * 100)
  });

  it("caps at platinum with a null nextTarget and 100 percent", () => {
    const result = evaluate(emptyMetrics({ drinks_total: 999 }), new Set());
    const entry = result.progress.find((p) => p.seriesId === "drinks_total")!;
    expect(entry.currentTier).toBe(4);
    expect(entry.nextTarget).toBeNull();
    expect(entry.percentage).toBe(100);
  });

  it("never reports a percentage outside 0..100", () => {
    const result = evaluate(
      emptyMetrics({ drinks_total: 7, reactions_given: 1_000_000 }),
      new Set(),
    );
    for (const entry of result.progress) {
      expect(entry.percentage).toBeGreaterThanOrEqual(0);
      expect(entry.percentage).toBeLessThanOrEqual(100);
    }
  });

  it("reports progress regardless of what is already unlocked", () => {
    const metrics = emptyMetrics({ drinks_total: 25 });
    const held = new Set(["drinks_total.t1", "drinks_total.t2", "drinks_total.t3"]);
    const result = evaluate(metrics, held);
    const entry = result.progress.find((p) => p.seriesId === "drinks_total")!;
    expect(entry.currentTier).toBe(3);
    expect(entry.nextTarget).toBe(50);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter=@prostcounter/shared test -- evaluator
```

Expected: FAIL with `Cannot find module './evaluator'`.

- [ ] **Step 3: Write the evaluator**

```ts
// packages/shared/src/achievements/evaluator.ts
import { ALL_DEFINITIONS, SERIES } from "./definitions";
import { isSeries, slugFor } from "./types";
import type {
  AchievementMetrics,
  AchievementTier,
  SeriesProgress,
  UnlockedAchievement,
} from "./types";

export interface EvaluationResult {
  /** Newly earned achievements, excluding anything in alreadyUnlocked. */
  unlocked: UnlockedAchievement[];
  /** Current standing of every series, independent of what is already unlocked. */
  progress: SeriesProgress[];
}

/**
 * Compare a user's metrics against every definition.
 *
 * Pure: no I/O, no clock, no randomness. Same inputs always give same outputs.
 *
 * @param metrics        Every metric for one (user, festival) pair.
 * @param alreadyUnlocked Slugs the user already holds. Used only to suppress
 *                        re-reporting; it never affects progress calculation.
 */
export function evaluate(
  metrics: AchievementMetrics,
  alreadyUnlocked: Set<string>,
): EvaluationResult {
  const unlocked: UnlockedAchievement[] = [];

  for (const definition of ALL_DEFINITIONS) {
    if (isSeries(definition)) {
      const value = metrics[definition.metric];
      for (const tierDef of definition.tiers) {
        if (value < tierDef.target) {
          continue;
        }
        const slug = slugFor(definition, tierDef.tier);
        if (alreadyUnlocked.has(slug)) {
          continue;
        }
        unlocked.push({
          slug,
          seriesId: definition.id,
          tier: tierDef.tier,
          category: definition.category,
          scope: definition.scope,
          glyph: definition.glyph,
          points: tierDef.points,
        });
      }
    } else {
      if (!metrics[definition.metric]) {
        continue;
      }
      const slug = slugFor(definition);
      if (alreadyUnlocked.has(slug)) {
        continue;
      }
      unlocked.push({
        slug,
        seriesId: null,
        tier: definition.tier,
        category: definition.category,
        scope: definition.scope,
        glyph: definition.glyph,
        points: definition.points,
      });
    }
  }

  const progress: SeriesProgress[] = SERIES.map((series) => {
    const currentValue = metrics[series.metric];

    let currentTier = 0;
    for (const tierDef of series.tiers) {
      if (currentValue >= tierDef.target) {
        currentTier = tierDef.tier;
      }
    }

    const nextTierDef = series.tiers.find((tierDef) => tierDef.tier === currentTier + 1);

    if (nextTierDef === undefined) {
      return {
        seriesId: series.id,
        category: series.category,
        scope: series.scope,
        glyph: series.glyph,
        currentTier,
        nextTarget: null,
        currentValue,
        percentage: 100,
      };
    }

    // Progress is measured from the tier just cleared, not from zero, so the
    // bar restarts on each unlock instead of creeping asymptotically.
    const floor = currentTier === 0 ? 0 : series.tiers[currentTier - 1].target;
    const span = nextTierDef.target - floor;
    const gained = currentValue - floor;
    const percentage = span <= 0 ? 100 : clampPercentage(Math.round((gained / span) * 100));

    return {
      seriesId: series.id,
      category: series.category,
      scope: series.scope,
      glyph: series.glyph,
      currentTier,
      nextTarget: nextTierDef.target,
      currentValue,
      percentage,
    };
  });

  return { unlocked, progress };
}

function clampPercentage(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

/** Highest tier held for a series, derived from a set of slugs. 0 if none. */
export function highestTierFor(seriesId: string, heldSlugs: Set<string>): number {
  let highest = 0;
  for (const tier of [1, 2, 3, 4] as AchievementTier[]) {
    if (heldSlugs.has(`${seriesId}.t${tier}`)) {
      highest = tier;
    }
  }
  return highest;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter=@prostcounter/shared test -- evaluator
```

Expected: PASS, 18 tests.

If "reports progress toward the next tier" fails with `28` or `30` instead of `29`, the floor/span arithmetic is wrong — recheck that `floor` uses `series.tiers[currentTier - 1].target` and not `currentTier`.

- [ ] **Step 5: Add the evaluator to the barrel export**

`evaluator.ts` now exists, so append this third line to `packages/shared/src/achievements/index.ts`:

```ts
export * from "./evaluator";
```

The file should now read:

```ts
// packages/shared/src/achievements/index.ts
export * from "./types";
export * from "./definitions";
export * from "./evaluator";
```

- [ ] **Step 6: Run the whole shared suite**

```bash
pnpm --filter=@prostcounter/shared test
```

Expected: PASS. The two achievements files contribute 30 tests (12 in `definitions.test.ts`, 18 in `evaluator.test.ts`). The suite also runs the pre-existing `src/data/__tests__/react-query-provider.test.ts`, which must keep passing.

- [ ] **Step 7: Type-check**

```bash
pnpm type-check
```

Expected: all 7 packages pass.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/achievements/
git commit -m "feat(shared): pure achievement evaluator"
```

---

## Task 5: The metrics SQL function

**Files:**
- Create: `supabase/migrations/<generated>_achievement_metrics_function.sql`
- Modify: `packages/db/src/types.ts` (regenerated)

**Interfaces:**
- Consumes: the indexes from Task 1; the key names in `AchievementMetrics` from Task 2.
- Produces: `get_achievement_metrics(p_user_id uuid, p_festival_id uuid) RETURNS jsonb`, whose keys exactly match `AchievementMetrics`.

**Pre-check:** Verify `packages/shared/src/achievements/types.ts` exists and its `AchievementMetrics` interface declares exactly 30 keys. If it declares a different number, STOP — the SQL below must match it key for key.

- [ ] **Step 1: Generate the migration file**

```bash
pnpm sup:mig:new achievement_metrics_function
```

- [ ] **Step 2: Write the function**

```sql
-- Returns every achievement metric for one (user, festival) pair as a single
-- jsonb object. Keys match the AchievementMetrics interface in
-- packages/shared/src/achievements/types.ts exactly. Changing one without the
-- other silently yields zeroes.
--
-- Festival-scoped metrics use p_festival_id. Lifetime metrics ignore it.
-- Written as a single SQL statement (not plpgsql) so the planner sees the whole
-- shape at once.

CREATE OR REPLACE FUNCTION public.get_achievement_metrics(
  p_user_id uuid,
  p_festival_id uuid
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH fest AS (
  SELECT id, start_date, end_date FROM festivals WHERE id = p_festival_id
),
user_att AS (
  SELECT a.id, a.date
  FROM attendances a
  WHERE a.user_id = p_user_id AND a.festival_id = p_festival_id
),
cons AS (
  SELECT c.drink_type, c.volume_ml, c.price_paid_cents, c.tip_cents, ua.date
  FROM user_att ua
  JOIN consumptions c ON c.attendance_id = ua.id
),
per_day AS (
  SELECT date, count(*) AS drinks FROM cons GROUP BY date
),
-- Gaps-and-islands: consecutive dates share (date - row_number).
att_streak AS (
  SELECT coalesce(max(run_len), 0) AS max_streak
  FROM (
    SELECT count(*) AS run_len
    FROM (
      SELECT date - (row_number() OVER (ORDER BY date))::int AS island
      FROM (SELECT DISTINCT date FROM user_att) distinct_days
    ) islands
    GROUP BY island
  ) runs
),
active_streak AS (
  SELECT coalesce(max(run_len), 0) AS max_streak
  FROM (
    SELECT count(*) AS run_len
    FROM (
      SELECT day - (row_number() OVER (ORDER BY day))::int AS island
      FROM (SELECT DISTINCT day FROM user_active_days WHERE user_id = p_user_id) d
    ) islands
    GROUP BY island
  ) runs
),
festival_weekend_days AS (
  SELECT count(*) AS total
  FROM fest, generate_series(fest.start_date, fest.end_date, '1 day'::interval) AS d
  WHERE extract(dow FROM d) IN (0, 6)
),
attended_weekend_days AS (
  SELECT count(DISTINCT ua.date) AS total
  FROM user_att ua
  WHERE extract(dow FROM ua.date) IN (0, 6)
),
large_tents AS (
  SELECT count(DISTINCT ft.tent_id) AS total
  FROM festival_tents ft
  JOIN tents t ON t.id = ft.tent_id
  WHERE ft.festival_id = p_festival_id AND t.category = 'large'
),
visited_large_tents AS (
  SELECT count(DISTINCT tv.tent_id) AS total
  FROM tent_visits tv
  JOIN tents t ON t.id = tv.tent_id
  WHERE tv.user_id = p_user_id
    AND tv.festival_id = p_festival_id
    AND t.category = 'large'
)
SELECT jsonb_build_object(
  -- festival-scoped, numeric
  'drinks_total',          (SELECT count(*) FROM cons),
  'drinks_day_max',        (SELECT coalesce(max(drinks), 0) FROM per_day),
  'drink_types_distinct',  (SELECT count(DISTINCT drink_type) FROM cons),
  'volume_ml_total',       (SELECT coalesce(sum(volume_ml), 0) FROM cons),
  'tip_cents_total',       (SELECT coalesce(sum(tip_cents), 0) FROM cons),
  'spend_cents_total',     (SELECT coalesce(sum(price_paid_cents), 0) FROM cons),
  'days_attended',         (SELECT count(DISTINCT date) FROM user_att),
  'attendance_streak_max', (SELECT max_streak FROM att_streak),
  'tents_distinct',        (SELECT count(DISTINCT tv.tent_id) FROM tent_visits tv
                              WHERE tv.user_id = p_user_id AND tv.festival_id = p_festival_id),
  'groups_joined',         (SELECT count(DISTINCT gm.group_id)
                              FROM group_members gm
                              JOIN groups g ON g.id = gm.group_id
                              WHERE gm.user_id = p_user_id AND g.festival_id = p_festival_id),
  'photos_uploaded',       (SELECT count(*) FROM beer_pictures bp
                              JOIN user_att ua ON ua.id = bp.attendance_id
                              WHERE bp.user_id = p_user_id),
  'reactions_given',       (SELECT count(*) FROM photo_reactions pr
                              JOIN beer_pictures bp ON bp.id = pr.photo_id
                              JOIN attendances a ON a.id = bp.attendance_id
                              WHERE pr.user_id = p_user_id AND a.festival_id = p_festival_id),
  'crowd_reports',         (SELECT count(*) FROM tent_crowd_reports tcr
                              WHERE tcr.user_id = p_user_id AND tcr.festival_id = p_festival_id),

  -- lifetime, numeric
  'festivals_attended',      (SELECT count(DISTINCT a.festival_id) FROM attendances a
                                WHERE a.user_id = p_user_id),
  'festival_types_distinct', (SELECT count(DISTINCT f.festival_type)
                                FROM attendances a JOIN festivals f ON f.id = a.festival_id
                                WHERE a.user_id = p_user_id),
  'friends_accepted',        (SELECT count(*) FROM friendships fr
                                WHERE fr.status = 'accepted'
                                  AND (fr.requester_id = p_user_id OR fr.addressee_id = p_user_id)),
  'group_wins',              (SELECT count(*) FROM festival_group_standings s
                                WHERE s.user_id = p_user_id AND s.rank = 1 AND s.member_count >= 2),
  'podium_finishes',         (SELECT count(*) FROM festival_group_standings s
                                WHERE s.user_id = p_user_id AND s.rank <= 3 AND s.member_count >= 2),
  'active_days_total',       (SELECT count(*) FROM user_active_days uad
                                WHERE uad.user_id = p_user_id),
  'active_day_streak_max',   (SELECT max_streak FROM active_streak),

  -- festival-scoped, boolean
  'attended_opening_day', (SELECT EXISTS (
                              SELECT 1 FROM user_att ua, fest
                              WHERE ua.date = fest.start_date)),
  'attended_closing_day', (SELECT EXISTS (
                              SELECT 1 FROM user_att ua, fest
                              WHERE ua.date = fest.end_date)),
  'attended_every_day',   (SELECT (SELECT count(DISTINCT date) FROM user_att)
                                  = (SELECT (end_date - start_date + 1) FROM fest)
                            AND (SELECT count(*) FROM user_att) > 0),
  'attended_every_weekend_day',
                          (SELECT (SELECT total FROM festival_weekend_days) > 0
                            AND (SELECT total FROM attended_weekend_days)
                                = (SELECT total FROM festival_weekend_days)),
  'visited_all_large_tents',
                          (SELECT (SELECT total FROM large_tents) > 0
                            AND (SELECT total FROM visited_large_tents)
                                = (SELECT total FROM large_tents)),
  'created_group',        (SELECT EXISTS (
                              SELECT 1 FROM groups g
                              WHERE g.created_by = p_user_id AND g.festival_id = p_festival_id)),

  -- lifetime, boolean
  'logged_first_drink',  (SELECT EXISTS (
                              SELECT 1 FROM consumptions c
                              JOIN attendances a ON a.id = c.attendance_id
                              WHERE a.user_id = p_user_id)),
  'uploaded_first_photo', (SELECT EXISTS (
                              SELECT 1 FROM beer_pictures bp WHERE bp.user_id = p_user_id)),
  'profile_complete',     (SELECT EXISTS (
                              SELECT 1 FROM profiles p
                              WHERE p.id = p_user_id
                                AND p.username IS NOT NULL
                                AND p.full_name IS NOT NULL
                                AND p.avatar_url IS NOT NULL)),
  'wrapped_viewed',       (SELECT EXISTS (
                              SELECT 1 FROM wrapped_data_cache w
                              WHERE w.user_id = p_user_id AND w.first_viewed_at IS NOT NULL))
);
$$;

COMMENT ON FUNCTION public.get_achievement_metrics(uuid, uuid) IS
  'Returns all achievement metrics for a (user, festival) pair as jsonb. Keys must match AchievementMetrics in packages/shared/src/achievements/types.ts.';

GRANT EXECUTE ON FUNCTION public.get_achievement_metrics(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_achievement_metrics(uuid, uuid) TO service_role;
```

- [ ] **Step 3: Apply it to the local database**

Use `mcp__supabase-local__execute_sql` with the full file contents.

- [ ] **Step 4: Verify the key set matches the TypeScript interface exactly**

Run via `mcp__supabase-local__execute_sql`:

```sql
SELECT jsonb_object_keys(
  get_achievement_metrics(
    (SELECT id FROM profiles LIMIT 1),
    (SELECT id FROM festivals ORDER BY start_date DESC LIMIT 1)
  )
) AS key ORDER BY key;
```

Expected: exactly 30 rows. Compare them against the keys in `AchievementMetrics`. Every key must appear in both, with identical spelling.

If the counts differ or any name mismatches, STOP. Do not "fix" it by renaming the TypeScript side.

- [ ] **Step 5: Verify it returns real values for a user with data**

```sql
SELECT get_achievement_metrics(
  '492e28f1-8133-491a-8423-13e4ded50a10',
  'a0000000-0000-4000-a000-000000000001'
);
```

Expected: `drinks_total` is 13, `days_attended` is 4, `tents_distinct` is 4.

If `drinks_total` is 0, the join through `attendances` is wrong. This is the exact failure mode that broke the old engine, so STOP and report rather than adjusting targets.

If those two UUIDs return no rows, the local seed differs from what this plan was written against. Find a user with data using the query below and use those IDs instead, noting the substitution in your report:

```sql
SELECT a.user_id, a.festival_id, count(c.id) AS drinks
FROM attendances a LEFT JOIN consumptions c ON c.attendance_id = a.id
GROUP BY 1,2 ORDER BY drinks DESC NULLS LAST LIMIT 3;
```

- [ ] **Step 6: Regenerate database types**

```bash
pnpm sup:db:types
```

- [ ] **Step 7: Type-check and commit**

```bash
pnpm type-check
git add supabase/migrations packages/db/src/types.ts
git commit -m "feat(db): add get_achievement_metrics function"
```

---

## Task 6: Competitive standings refresh

**Files:**
- Create: `supabase/migrations/<generated>_festival_group_standings_refresh.sql`
- Modify: `apps/web/app/api/cron/scheduler/route.ts`
- Modify: `packages/db/src/types.ts` (regenerated)

**Interfaces:**
- Consumes: `festival_group_standings` from Task 1; the existing `get_group_leaderboard(p_group_id uuid, p_winning_criteria_id integer)`.
- Produces: `refresh_festival_group_standings(p_festival_id uuid) RETURNS integer` returning the number of standing rows written.

**Pre-check:** Verify `get_group_leaderboard` exists and takes `(uuid, integer)`. Run via `mcp__supabase-local__execute_sql`:

```sql
SELECT pg_get_function_identity_arguments(oid)
FROM pg_proc WHERE proname = 'get_group_leaderboard';
```

Expected: `p_group_id uuid, p_winning_criteria_id integer`. If it differs, STOP.

- [ ] **Step 1: Generate the migration file**

```bash
pnpm sup:mig:new festival_group_standings_refresh
```

- [ ] **Step 2: Write the function**

```sql
-- Materialises final group standings for one festival.
-- Past festivals are immutable, so this is computed once when a festival ends
-- and refreshed nightly only for the active one.

CREATE OR REPLACE FUNCTION public.refresh_festival_group_standings(
  p_festival_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group record;
  v_rows_written integer := 0;
BEGIN
  DELETE FROM festival_group_standings WHERE festival_id = p_festival_id;

  FOR v_group IN
    SELECT g.id, g.winning_criteria_id,
           (SELECT count(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
    FROM groups g
    WHERE g.festival_id = p_festival_id
  LOOP
    INSERT INTO festival_group_standings
      (festival_id, group_id, user_id, rank, member_count, criteria_id)
    SELECT
      p_festival_id,
      v_group.id,
      lb.user_id,
      row_number() OVER (ORDER BY lb.total_beers DESC, lb.days_attended DESC, lb.user_id),
      v_group.member_count,
      v_group.winning_criteria_id
    FROM get_group_leaderboard(v_group.id, v_group.winning_criteria_id) lb
    ON CONFLICT (festival_id, group_id, user_id) DO NOTHING;

    GET DIAGNOSTICS v_rows_written = ROW_COUNT;
  END LOOP;

  SELECT count(*) INTO v_rows_written
  FROM festival_group_standings WHERE festival_id = p_festival_id;

  RETURN v_rows_written;
END;
$$;

COMMENT ON FUNCTION public.refresh_festival_group_standings(uuid) IS
  'Recomputes final group standings for a festival. Safe to re-run; deletes and rebuilds.';

GRANT EXECUTE ON FUNCTION public.refresh_festival_group_standings(uuid) TO service_role;
```

- [ ] **Step 3: Apply it and backfill every festival**

Apply via `mcp__supabase-local__execute_sql`, then run:

```sql
SELECT f.name, refresh_festival_group_standings(f.id) AS rows_written
FROM festivals f ORDER BY f.start_date;
```

Expected: one row per festival with a non-negative `rows_written`. Festivals with no groups return 0, which is correct.

- [ ] **Step 4: Verify standings look sane**

```sql
SELECT festival_id, group_id, count(*) AS members, min(rank), max(rank)
FROM festival_group_standings
GROUP BY 1, 2
ORDER BY members DESC
LIMIT 5;
```

Expected: for each group, `min(rank) = 1` and `max(rank) = members`. Ranks must be a contiguous 1..N with no gaps or duplicates.

If any group shows `min(rank) > 1` or duplicate ranks, STOP.

- [ ] **Step 5: Add the nightly refresh to the cron scheduler**

Open `apps/web/app/api/cron/scheduler/route.ts`. Locate where the existing scheduled jobs are invoked. Add a call that refreshes standings for the currently active festival only:

```ts
// Refresh competitive standings for the active festival.
// Past festivals are immutable and were materialised once at creation time.
const { data: activeFestival } = await supabase
  .from("festivals")
  .select("id")
  .eq("is_active", true)
  .maybeSingle();

if (activeFestival) {
  const { error: standingsError } = await supabase.rpc("refresh_festival_group_standings", {
    p_festival_id: activeFestival.id,
  });
  if (standingsError) {
    console.error("Failed to refresh festival group standings", standingsError);
  }
}
```

**Pre-check before editing:** read the file first and match its existing style for obtaining `supabase` and for error handling. If it uses a logger rather than `console.error`, use the logger. If the shape of the file makes this insertion ambiguous, STOP and report what you found.

- [ ] **Step 6: Regenerate types, type-check, commit**

```bash
pnpm sup:db:types
pnpm type-check
git add supabase/migrations packages/db/src/types.ts apps/web/app/api/cron/scheduler/route.ts
git commit -m "feat(db): materialise festival group standings"
```

---

## Task 7: Metrics repository and achievement service

**Files:**
- Create: `packages/api/src/repositories/supabase/achievement-metrics.repository.ts`
- Create: `packages/api/src/services/achievement.service.ts`
- Create: `packages/api/src/services/__tests__/achievement.service.test.ts`
- Modify: `packages/api/src/repositories/supabase/index.ts`

**Interfaces:**
- Consumes: `evaluate`, `AchievementMetrics`, `UnlockedAchievement` from `@prostcounter/shared/achievements`; the RPC from Task 5.
- Produces:
  - `AchievementMetricsRepository` with `getMetrics(userId, festivalId): Promise<AchievementMetrics>`, `getHeldSlugs(userId, festivalId): Promise<Set<string>>`, `insertUnlocks(userId, festivalId, unlocks): Promise<UnlockedAchievement[]>`.
  - `AchievementService` with `evaluateAndUnlock(userId, festivalId): Promise<UnlockedAchievement[]>` and `getProgress(userId, festivalId): Promise<EvaluationResult>`.

**Pre-check:** Verify `packages/api/src/repositories/supabase/index.ts` exists and re-exports the other repositories. If it does not, STOP.

- [ ] **Step 1: Write the failing service test**

```ts
// packages/api/src/services/__tests__/achievement.service.test.ts
import type { AchievementMetrics, UnlockedAchievement } from "@prostcounter/shared/achievements";

import { AchievementService } from "../achievement.service";

function emptyMetrics(overrides: Partial<AchievementMetrics> = {}): AchievementMetrics {
  return {
    drinks_total: 0,
    drinks_day_max: 0,
    drink_types_distinct: 0,
    volume_ml_total: 0,
    tip_cents_total: 0,
    spend_cents_total: 0,
    days_attended: 0,
    attendance_streak_max: 0,
    tents_distinct: 0,
    groups_joined: 0,
    photos_uploaded: 0,
    reactions_given: 0,
    crowd_reports: 0,
    festivals_attended: 0,
    festival_types_distinct: 0,
    friends_accepted: 0,
    group_wins: 0,
    podium_finishes: 0,
    active_days_total: 0,
    active_day_streak_max: 0,
    attended_opening_day: false,
    attended_closing_day: false,
    attended_every_day: false,
    attended_every_weekend_day: false,
    visited_all_large_tents: false,
    created_group: false,
    logged_first_drink: false,
    uploaded_first_photo: false,
    profile_complete: false,
    wrapped_viewed: false,
    ...overrides,
  };
}

function makeRepo(metrics: AchievementMetrics, held: Set<string> = new Set()) {
  const inserted: UnlockedAchievement[] = [];
  return {
    inserted,
    repo: {
      getMetrics: async () => metrics,
      getHeldSlugs: async () => held,
      insertUnlocks: async (
        _userId: string,
        _festivalId: string,
        unlocks: UnlockedAchievement[],
      ) => {
        inserted.push(...unlocks);
        return unlocks;
      },
    },
  };
}

describe("AchievementService.evaluateAndUnlock", () => {
  it("persists and returns newly earned unlocks", async () => {
    const { repo, inserted } = makeRepo(emptyMetrics({ drinks_total: 3 }));
    const service = new AchievementService(repo as never);

    const result = await service.evaluateAndUnlock("user-1", "festival-1");

    expect(result.map((u) => u.slug)).toContain("drinks_total.t1");
    expect(inserted.map((u) => u.slug)).toContain("drinks_total.t1");
  });

  it("returns an empty array and writes nothing when nothing is earned", async () => {
    const { repo, inserted } = makeRepo(emptyMetrics());
    const service = new AchievementService(repo as never);

    const result = await service.evaluateAndUnlock("user-1", "festival-1");

    expect(result).toEqual([]);
    expect(inserted).toEqual([]);
  });

  it("does not re-unlock what the user already holds", async () => {
    const { repo, inserted } = makeRepo(
      emptyMetrics({ drinks_total: 3 }),
      new Set(["drinks_total.t1"]),
    );
    const service = new AchievementService(repo as never);

    const result = await service.evaluateAndUnlock("user-1", "festival-1");

    expect(result).toEqual([]);
    expect(inserted).toEqual([]);
  });

  it("unlocks every tier crossed in one call", async () => {
    const { repo } = makeRepo(emptyMetrics({ drinks_total: 25 }));
    const service = new AchievementService(repo as never);

    const result = await service.evaluateAndUnlock("user-1", "festival-1");
    const drinkUnlocks = result.filter((u) => u.seriesId === "drinks_total");

    expect(drinkUnlocks).toHaveLength(3);
  });
});

describe("AchievementService.getProgress", () => {
  it("returns progress for every series without writing anything", async () => {
    const { repo, inserted } = makeRepo(emptyMetrics({ drinks_total: 5 }));
    const service = new AchievementService(repo as never);

    const result = await service.getProgress("user-1", "festival-1");

    expect(result.progress.length).toBeGreaterThan(0);
    expect(inserted).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter=@prostcounter/api test -- achievement.service
```

Expected: FAIL with `Cannot find module '../achievement.service'`.

- [ ] **Step 3: Write the repository**

```ts
// packages/api/src/repositories/supabase/achievement-metrics.repository.ts
import type { Database } from "@prostcounter/db";
import type { AchievementMetrics, UnlockedAchievement } from "@prostcounter/shared/achievements";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";

export class AchievementMetricsRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getMetrics(userId: string, festivalId: string): Promise<AchievementMetrics> {
    const { data, error } = await this.supabase.rpc("get_achievement_metrics", {
      p_user_id: userId,
      p_festival_id: festivalId,
    });

    if (error) {
      throw new DatabaseError(`Failed to fetch achievement metrics: ${error.message}`);
    }

    return data as unknown as AchievementMetrics;
  }

  /**
   * Slugs the user already holds, covering both scopes: rows for this festival
   * plus lifetime rows, which carry a NULL festival_id.
   */
  async getHeldSlugs(userId: string, festivalId: string): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from("user_achievements")
      .select("achievements(slug)")
      .eq("user_id", userId)
      .or(`festival_id.eq.${festivalId},festival_id.is.null`);

    if (error) {
      throw new DatabaseError(`Failed to fetch held achievements: ${error.message}`);
    }

    const slugs = new Set<string>();
    for (const row of data ?? []) {
      const slug = (row as { achievements: { slug: string | null } | null }).achievements?.slug;
      if (slug) {
        slugs.add(slug);
      }
    }
    return slugs;
  }

  /**
   * Inserts unlock rows. Lifetime unlocks are stored with a NULL festival_id.
   * Conflicts are ignored so concurrent evaluations cannot double-insert.
   */
  async insertUnlocks(
    userId: string,
    festivalId: string,
    unlocks: UnlockedAchievement[],
  ): Promise<UnlockedAchievement[]> {
    if (unlocks.length === 0) {
      return [];
    }

    const slugs = unlocks.map((unlock) => unlock.slug);
    const { data: rows, error: lookupError } = await this.supabase
      .from("achievements")
      .select("id, slug")
      .in("slug", slugs);

    if (lookupError) {
      throw new DatabaseError(`Failed to resolve achievement slugs: ${lookupError.message}`);
    }

    const slugToId = new Map<string, string>();
    for (const row of rows ?? []) {
      if (row.slug) {
        slugToId.set(row.slug, row.id);
      }
    }

    const payload = unlocks
      .filter((unlock) => slugToId.has(unlock.slug))
      .map((unlock) => ({
        user_id: userId,
        achievement_id: slugToId.get(unlock.slug) as string,
        festival_id: unlock.scope === "lifetime" ? null : festivalId,
      }));

    if (payload.length === 0) {
      return [];
    }

    const { error: insertError } = await this.supabase
      .from("user_achievements")
      .upsert(payload, {
        onConflict: "user_id,achievement_id,festival_id",
        ignoreDuplicates: true,
      });

    if (insertError) {
      throw new DatabaseError(`Failed to insert unlocks: ${insertError.message}`);
    }

    return unlocks.filter((unlock) => slugToId.has(unlock.slug));
  }
}
```

- [ ] **Step 4: Write the service**

```ts
// packages/api/src/services/achievement.service.ts
import type { EvaluationResult, UnlockedAchievement } from "@prostcounter/shared/achievements";
import { evaluate } from "@prostcounter/shared/achievements";

import type { AchievementMetricsRepository } from "../repositories/supabase/achievement-metrics.repository";

export class AchievementService {
  constructor(private metricsRepo: AchievementMetricsRepository) {}

  /**
   * Evaluate the user's metrics and persist anything newly earned.
   * Returns only the newly unlocked achievements, for the caller to surface.
   */
  async evaluateAndUnlock(userId: string, festivalId: string): Promise<UnlockedAchievement[]> {
    const [metrics, heldSlugs] = await Promise.all([
      this.metricsRepo.getMetrics(userId, festivalId),
      this.metricsRepo.getHeldSlugs(userId, festivalId),
    ]);

    const { unlocked } = evaluate(metrics, heldSlugs);

    if (unlocked.length === 0) {
      return [];
    }

    return this.metricsRepo.insertUnlocks(userId, festivalId, unlocked);
  }

  /** Read-only. Computes progress without persisting anything. */
  async getProgress(userId: string, festivalId: string): Promise<EvaluationResult> {
    const [metrics, heldSlugs] = await Promise.all([
      this.metricsRepo.getMetrics(userId, festivalId),
      this.metricsRepo.getHeldSlugs(userId, festivalId),
    ]);

    return evaluate(metrics, heldSlugs);
  }
}
```

- [ ] **Step 5: Export the repository**

In `packages/api/src/repositories/supabase/index.ts`, add:

```ts
export * from "./achievement-metrics.repository";
```

Match the existing export style in that file. If it uses named re-exports rather than `export *`, follow that instead.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
pnpm --filter=@prostcounter/api test -- achievement.service
```

Expected: PASS, 5 tests.

- [ ] **Step 7: Type-check and commit**

```bash
pnpm type-check
git add packages/api/src/repositories packages/api/src/services
git commit -m "feat(api): achievement metrics repository and service"
```

---

## Task 8: Registry sync script

**Files:**
- Create: `packages/api/src/scripts/sync-achievement-registry.ts`
- Modify: `packages/api/package.json`

**Interfaces:**
- Consumes: `ALL_DEFINITIONS`, `SERIES`, `isSeries`, `slugFor` from `@prostcounter/shared/achievements`; the `achievements` table columns from Task 1.
- Produces: 90 rows in `achievements` carrying `slug`, `series_id`, `tier`, `scope`, `category`, `points`, `icon`. A `pnpm --filter=@prostcounter/api sync:achievements` script.

Definitions live in TypeScript, but the database needs rows so that `user_achievements.achievement_id` has something to reference. This script projects one into the other. It is idempotent.

**Pre-check:** Verify `packages/api/src/scripts/` exists. The api vitest config excludes `src/scripts/**` from coverage, which implies it does. If the directory is absent, create it.

- [ ] **Step 1: Write the script**

```ts
// packages/api/src/scripts/sync-achievement-registry.ts
/**
 * Projects the TypeScript achievement definitions into the achievements table.
 *
 * Definitions are the source of truth. This script makes the database match
 * them. It is idempotent: re-running changes nothing if definitions are unchanged.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm --filter=@prostcounter/api sync:achievements
 *   add --dry-run to print the plan without writing
 */
import { ALL_DEFINITIONS, isSeries, slugFor } from "@prostcounter/shared/achievements";
import type { AchievementCategory, AchievementScope } from "@prostcounter/shared/achievements";
import { createClient } from "@supabase/supabase-js";

type AchievementRarity = "common" | "rare" | "epic" | "legendary";

interface RegistryRow {
  slug: string;
  series_id: string | null;
  tier: number;
  scope: AchievementScope;
  category: AchievementCategory;
  points: number;
  icon: string;
  rarity: AchievementRarity;
  name: string;
  description: string;
  is_active: boolean;
}

/**
 * The achievements table still carries the legacy `rarity` enum, and the
 * notification cron filters on it. Until Plan 2 replaces rarity with tier,
 * derive one from the other so new achievements keep notifying.
 */
const RARITY_BY_TIER: Record<number, AchievementRarity> = {
  1: "common",
  2: "rare",
  3: "epic",
  4: "legendary",
};

function rarityForTier(tier: number): AchievementRarity {
  const rarity = RARITY_BY_TIER[tier];
  if (!rarity) {
    throw new Error(`No rarity mapping for tier ${tier}`);
  }
  return rarity;
}

export function buildRegistryRows(): RegistryRow[] {
  const rows: RegistryRow[] = [];

  for (const definition of ALL_DEFINITIONS) {
    if (isSeries(definition)) {
      for (const tierDef of definition.tiers) {
        const slug = slugFor(definition, tierDef.tier);
        rows.push({
          slug,
          series_id: definition.id,
          tier: tierDef.tier,
          scope: definition.scope,
          category: definition.category,
          points: tierDef.points,
          icon: definition.glyph,
          rarity: rarityForTier(tierDef.tier),
          name: `achievements.${slug}.name`,
          description: `achievements.${slug}.description`,
          is_active: true,
        });
      }
    } else {
      const slug = slugFor(definition);
      rows.push({
        slug,
        series_id: null,
        tier: definition.tier,
        scope: definition.scope,
        category: definition.category,
        points: definition.points,
        icon: definition.glyph,
        rarity: rarityForTier(definition.tier),
        name: `achievements.${slug}.name`,
        description: `achievements.${slug}.description`,
        is_active: true,
      });
    }
  }

  return rows;
}

async function main(): Promise<void> {
  const isDryRun = process.argv.includes("--dry-run");
  const rows = buildRegistryRows();

  console.log(`Built ${rows.length} registry rows from definitions.`);

  if (isDryRun) {
    for (const row of rows) {
      console.log(`  ${row.slug.padEnd(28)} ${row.category.padEnd(12)} t${row.tier} ${row.points}pts`);
    }
    console.log("Dry run: nothing written.");
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabase.from("achievements").upsert(rows, { onConflict: "slug" });

  if (error) {
    throw new Error(`Failed to sync achievement registry: ${error.message}`);
  }

  console.log(`Synced ${rows.length} achievements.`);
}

// Only run when executed directly, so the builder stays importable by tests.
if (process.argv[1]?.endsWith("sync-achievement-registry.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
```

Note on `category`: the DB column is `achievement_category_enum`, whose current values are `consumption, attendance, explorer, social, competitive, special`. The new category names (`drinking`, `dedication`) are **not** in that enum yet. Step 2 adds them.

Note on `rarity`: `achievements.rarity` is `NOT NULL DEFAULT 'common'`, and a trigger copies it into `achievement_events.rarity`, which the notification cron filters on. If the sync omitted `rarity`, all 90 new rows would land as `common` and **no** new achievement would ever produce a group notification. Deriving rarity from tier keeps the existing notification path working without a schema change; Plan 2 replaces the column with `tier` outright.

- [ ] **Step 2: Extend the category enum**

Generate a migration:

```bash
pnpm sup:mig:new achievement_category_enum_values
```

Contents:

```sql
-- The revamp introduces two category names the enum does not yet carry.
-- Old values stay for now; Plan 2 removes them after the remap.
ALTER TYPE public.achievement_category_enum ADD VALUE IF NOT EXISTS 'drinking';
ALTER TYPE public.achievement_category_enum ADD VALUE IF NOT EXISTS 'dedication';
```

Apply via `mcp__supabase-local__execute_sql`.

**Important:** `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block in Postgres. Run each statement on its own. If the MCP tool reports `ALTER TYPE ... cannot run inside a transaction block`, run the two statements as two separate `execute_sql` calls.

- [ ] **Step 3: Add the package script**

In `packages/api/package.json`, add to `"scripts"`:

```json
    "sync:achievements": "tsx src/scripts/sync-achievement-registry.ts"
```

**Pre-check:** verify `tsx` is available in that package. Run `pnpm --filter=@prostcounter/api exec tsx --version`. If it is not installed, check how other scripts in `packages/api/package.json` are run and match that runner instead. If there are no other scripts, STOP and report.

- [ ] **Step 4: Dry-run the script**

```bash
pnpm --filter=@prostcounter/api sync:achievements -- --dry-run
```

Expected: prints exactly 90 rows, then "Dry run: nothing written."

If the count is not 90, STOP.

- [ ] **Step 5: Run it against the local database**

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<local service role key> \
pnpm --filter=@prostcounter/api sync:achievements
```

Get the local service role key from `supabase status`.

- [ ] **Step 6: Verify the registry**

Run via `mcp__supabase-local__execute_sql`:

```sql
SELECT scope, count(*) FROM achievements WHERE slug IS NOT NULL GROUP BY scope ORDER BY scope;
SELECT count(*) AS total_new FROM achievements WHERE slug IS NOT NULL;
SELECT count(*) AS legacy FROM achievements WHERE slug IS NULL;
```

Expected: `total_new = 90`, `legacy = 41`. The 41 old rows are untouched and stay until Plan 2.

- [ ] **Step 7: Regenerate types, type-check, commit**

```bash
pnpm sup:db:types
pnpm type-check
git add supabase/migrations packages/db/src/types.ts packages/api/src/scripts packages/api/package.json
git commit -m "feat(api): sync achievement registry from definitions"
```

---

## Task 9: Activity tracking middleware

**Files:**
- Modify: `packages/api/src/middleware/auth.ts`

**Interfaces:**
- Consumes: `user_active_days` from Task 1.
- Produces: one upsert per authenticated request, fire-and-forget.

**Pre-check:** Verify `packages/api/src/middleware/auth.ts` still contains `c.set("user", user);` followed by `c.set("supabase", supabase);` then `await next();` inside `authMiddleware`. If the shape differs, STOP.

- [ ] **Step 1: Add the tracking helper**

Add this function to `packages/api/src/middleware/auth.ts`, above `authMiddleware`:

```ts
/**
 * Record that this user was active today.
 *
 * Deliberately not awaited by the caller: this must add zero latency to any
 * request. Failures are swallowed because activity tracking must never break
 * an authenticated request.
 *
 * Feeds the "active_days_total" and "active_day_streak_max" achievement metrics,
 * and provides DAU/WAU/MAU and retention data that is otherwise unobtainable —
 * auth.users.last_sign_in_at keeps only the most recent value.
 */
function recordActiveDay(supabase: SupabaseClient, userId: string, platform?: string, appVersion?: string): void {
  void supabase
    .rpc("record_user_active_day", {
      p_user_id: userId,
      p_platform: platform ?? null,
      p_app_version: appVersion ?? null,
    })
    .then(({ error }) => {
      if (error) {
        // pino: mergingObject first, message second (see auth.ts:106, error.ts:107,159 for the
        // established convention) — the reverse order silently drops the fields from log output.
        logger.warn({ userId, error: error.message }, "Failed to record active day");
      }
    });
}
```

- [ ] **Step 2: Call it from the middleware**

In `authMiddleware`, immediately after `c.set("supabase", supabase);` and before `await next();`, insert:

```ts
  recordActiveDay(
    supabase,
    user.id,
    c.req.header("X-Client-Platform"),
    c.req.header("X-Client-Version"),
  );
```

- [ ] **Step 3: Create the RPC the helper calls**

The upsert goes through an RPC rather than a direct table write so that RLS does not need an INSERT policy for authenticated users.

```bash
pnpm sup:mig:new record_user_active_day
```

Contents:

```sql
-- Records daily app activity. SECURITY DEFINER so authenticated users can write
-- their own row without an INSERT policy on the table.
CREATE OR REPLACE FUNCTION public.record_user_active_day(
  p_user_id     uuid,
  p_platform    text DEFAULT NULL,
  p_app_version text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Callers may only record activity for themselves.
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'record_user_active_day: user mismatch';
  END IF;

  INSERT INTO user_active_days (user_id, day, platform, app_version)
  VALUES (p_user_id, current_date, p_platform, p_app_version)
  ON CONFLICT (user_id, day) DO UPDATE
    SET last_seen_at  = now(),
        request_count = user_active_days.request_count + 1,
        platform      = coalesce(excluded.platform, user_active_days.platform),
        app_version   = coalesce(excluded.app_version, user_active_days.app_version);
END;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and anon inherits it via PUBLIC.
-- The auth.uid() check above already stops anon from writing anyone's row (anon
-- has no JWT, so auth.uid() is NULL, and IS DISTINCT FROM only passes when
-- p_user_id is also NULL, which then fails user_active_days' NOT NULL/FK on
-- user_id) — but leaving it anon-executable still contradicts the explicit-grant
-- convention this repo just adopted for every other SECURITY DEFINER function
-- (see fix/harden-security-definer-grants). Revoke first, then grant narrowly.
REVOKE EXECUTE ON FUNCTION public.record_user_active_day(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_user_active_day(uuid, text, text) TO authenticated, service_role;
```

Apply via `mcp__supabase-local__execute_sql`.

- [ ] **Step 4: Verify with an authenticated request**

Start the API locally, make any authenticated request, then run via `mcp__supabase-local__execute_sql`:

```sql
SELECT user_id, day, request_count, platform FROM user_active_days ORDER BY last_seen_at DESC LIMIT 5;
```

Expected: at least one row for today with `request_count >= 1`.

If the table is empty, the helper is failing silently by design. Temporarily change `logger.warn` to `logger.error` and re-check the API logs. STOP and report the error rather than guessing.

- [ ] **Step 5: Regenerate types, type-check, commit**

```bash
pnpm sup:db:types
pnpm type-check
git add supabase/migrations packages/db/src/types.ts packages/api/src/middleware/auth.ts
git commit -m "feat(api): track daily user activity"
```

---

## Task 10: Wire evaluation into the write path and serve progress

**Files:**
- Modify: `packages/api/src/routes/consumption.route.ts:91-105`
- Modify: `packages/api/src/routes/achievement.route.ts:185-267`
- Modify: `packages/api/src/repositories/supabase/achievement.repository.ts:28`
- Modify: `packages/shared/src/schemas/achievement.schema.ts`

**Interfaces:**
- Consumes: `AchievementService` and `AchievementMetricsRepository` from Task 7.
- Produces: `POST /consumption` responses carrying `unlocked: UnlockedAchievement[]`; `GET /achievements/with-progress` served by the new engine while keeping its existing `{ data, stats }` shape.

**Pre-check:** Verify `packages/api/src/routes/consumption.route.ts` line 91 begins `app.openapi(logConsumptionRoute, async (c) => {` and the handler ends with `return c.json(attendance, 200);`. If it differs, STOP.

- [ ] **Step 1: Fix the pre-existing repository bug**

In `packages/api/src/repositories/supabase/achievement.repository.ts`, the select list at line 28 includes `condition`, which is not a column on `achievements` (the real column is `conditions`). Remove that line from the select string, and remove the `condition: achievement.condition,` line from `mapToUserAchievement`.

Also remove `condition` from the `UserAchievement` achievement shape in `packages/shared/src/schemas/achievement.schema.ts` if it is declared there. If removing it breaks a consumer, STOP and report which one.

- [ ] **Step 2: Write a failing integration test for the unlock response**

```ts
// packages/api/src/routes/__tests__/achievement-unlock.integration.test.ts
// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test -- --run achievement-unlock.integration

import { AchievementMetricsRepository } from "../../repositories/supabase/achievement-metrics.repository";
import { AchievementService } from "../../services/achievement.service";
import { supabaseAdmin } from "../../__tests__/helpers/supabase-admin";

describe("achievement unlocking against a real database", () => {
  it("unlocks the first-drink achievement for a user with consumptions", async () => {
    const { data: rows } = await supabaseAdmin
      .from("attendances")
      .select("user_id, festival_id")
      .limit(1);

    const target = rows?.[0];
    if (!target) {
      throw new Error("No attendance rows in local database; seed it first");
    }

    const repo = new AchievementMetricsRepository(supabaseAdmin);
    const service = new AchievementService(repo);

    const metrics = await repo.getMetrics(target.user_id as string, target.festival_id);
    expect(Object.keys(metrics)).toHaveLength(30);

    const unlocked = await service.evaluateAndUnlock(
      target.user_id as string,
      target.festival_id,
    );

    // Second call must be a no-op: everything is already held.
    const second = await service.evaluateAndUnlock(
      target.user_id as string,
      target.festival_id,
    );
    expect(second).toEqual([]);
    expect(Array.isArray(unlocked)).toBe(true);
  });
});
```

**Pre-check:** verify `packages/api/src/__tests__/helpers/supabase-admin.ts` exists and exports `supabaseAdmin`. The existing integration tests reference `supabaseAdmin`, so it should. If the path or export name differs, use the actual one and note the change.

- [ ] **Step 3: Run the integration test to verify it fails or passes meaningfully**

```bash
pnpm --filter=@prostcounter/api test -- achievement-unlock.integration
```

The default vitest config excludes `*.integration.test.ts`. If it does not run, invoke it explicitly:

```bash
pnpm --filter=@prostcounter/api exec vitest run src/routes/__tests__/achievement-unlock.integration.test.ts --exclude ''
```

Expected on first run: PASS, because Tasks 5, 7 and 8 already built everything it exercises. This test guards the wiring, not new behaviour. If it fails on `toHaveLength(30)`, the SQL function and the TS interface have diverged — STOP.

- [ ] **Step 4: Wire evaluation into the consumption route**

Replace the body of the `logConsumptionRoute` handler in `packages/api/src/routes/consumption.route.ts` (lines 91-105) with:

```ts
app.openapi(logConsumptionRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const data = c.req.valid("json");

  // Initialize repositories and service
  const consumptionRepo = new SupabaseConsumptionRepository(supabase);
  const attendanceRepo = new SupabaseAttendanceRepository(supabase);
  const service = new ConsumptionService(consumptionRepo, attendanceRepo);

  // Log consumption
  const attendance = await service.logConsumption(user.id, data);

  // Evaluate achievements. This must never fail the mutation: a broken
  // achievement engine cannot be allowed to stop someone logging a drink.
  let unlocked: UnlockedAchievement[] = [];
  try {
    const metricsRepo = new AchievementMetricsRepository(supabase);
    const achievementService = new AchievementService(metricsRepo);
    unlocked = await achievementService.evaluateAndUnlock(user.id, data.festivalId);
  } catch (error) {
    logger.error("Achievement evaluation failed after logging consumption", {
      userId: user.id,
      festivalId: data.festivalId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return c.json({ ...attendance, unlocked }, 200);
});
```

Add the imports at the top of the file:

```ts
import type { UnlockedAchievement } from "@prostcounter/shared/achievements";

import { logger } from "../lib/logger";
import { AchievementMetricsRepository } from "../repositories/supabase/achievement-metrics.repository";
import { AchievementService } from "../services/achievement.service";
```

**Pre-check:** confirm `packages/api/src/lib/logger.ts` exports `logger`. `auth.ts` imports it as `import { logger } from "../lib/logger";`, so from `routes/` the path is also `../lib/logger`. Verify before writing.

- [ ] **Step 5: Extend the response schema**

In `packages/shared/src/schemas/achievement.schema.ts`, add and export a Zod schema for an unlock:

```ts
export const UnlockedAchievementSchema = z.object({
  slug: z.string(),
  seriesId: z.string().nullable(),
  tier: z.number().int().min(1).max(4),
  category: z.enum([
    "drinking",
    "attendance",
    "explorer",
    "social",
    "competitive",
    "dedication",
  ]),
  scope: z.enum(["festival", "lifetime"]),
  glyph: z.string(),
  points: z.number().int(),
});
```

Then in `packages/shared/src/schemas/consumption.schema.ts`, add `unlocked` to the log-consumption response schema:

```ts
  unlocked: z.array(UnlockedAchievementSchema).default([]),
```

**Pre-check:** open `packages/shared/src/schemas/consumption.schema.ts` and find the schema referenced by `logConsumptionRoute`'s 200 response. Add the field to that exact schema. If you cannot identify it unambiguously, STOP.

- [ ] **Step 6: Serve with-progress from the new engine**

Replace the handler body of `getAchievementsWithProgressRoute` in `packages/api/src/routes/achievement.route.ts` (lines 185-267). Keep the outer `{ data, stats }` response shape so the existing web and mobile screens keep working.

```ts
app.openapi(getAchievementsWithProgressRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const query = c.req.valid("query");

  const metricsRepo = new AchievementMetricsRepository(supabase);
  const achievementService = new AchievementService(metricsRepo);

  const [{ progress }, heldSlugs, registry] = await Promise.all([
    achievementService.getProgress(user.id, query.festivalId),
    metricsRepo.getHeldSlugs(user.id, query.festivalId),
    supabase
      .from("achievements")
      .select("id, slug, series_id, tier, scope, category, points, icon, name, description")
      .not("slug", "is", null)
      .order("category")
      .order("points"),
  ]);

  if (registry.error) {
    throw new Error(`Failed to fetch achievement registry: ${registry.error.message}`);
  }

  const progressBySeries = new Map(progress.map((entry) => [entry.seriesId, entry]));
  const seriesById = new Map(SERIES.map((series) => [series.id, series]));

  // `progress` from evaluate() has ONE entry per series: the series' overall
  // standing toward whichever locked tier comes next. But `registry.data`
  // has one ROW PER TIER (80 of the 90 rows: 20 series x 4 tiers), and
  // AchievementWithProgressSchema gives every row its own user_progress. If
  // every tier row of a series just reused the single series-level entry,
  // every locked tier beyond the immediately-next one would display the
  // WRONG target and percentage (borrowed from whatever tier happens to be
  // "next", not its own threshold) — e.g. a tier-3 row with target 25 would
  // show target 10 (tier 2's number) while the user is still working on
  // tier 2. So each row computes its own target from that tier's definition,
  // and its own percentage using the same floor/span formula evaluate() uses
  // for the "next" tier, just anchored to THIS row's tier instead.
  const achievements: AchievementWithProgress[] = (registry.data ?? []).map((row) => {
    const isUnlocked = row.slug ? heldSlugs.has(row.slug) : false;
    const seriesProgress = row.series_id ? progressBySeries.get(row.series_id) : undefined;

    let currentValue = isUnlocked ? 1 : 0;
    let targetValue = 1;
    let percentage = isUnlocked ? 100 : 0;

    if (row.series_id && row.tier && seriesProgress) {
      const series = seriesById.get(row.series_id);
      const ownTierDef = series?.tiers.find((t) => t.tier === row.tier);
      const priorTierDef = series?.tiers.find((t) => t.tier === row.tier - 1);
      const floor = priorTierDef?.target ?? 0;
      const target = ownTierDef?.target ?? seriesProgress.nextTarget ?? 1;

      currentValue = seriesProgress.currentValue;
      targetValue = target;

      if (isUnlocked) {
        percentage = 100;
      } else {
        // Same formula as evaluate()'s progress calc, anchored to this row's
        // own tier rather than only ever the next one.
        const span = target - floor;
        const gained = currentValue - floor;
        percentage =
          span <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((gained / span) * 100)));
      }
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      icon: row.icon,
      points: row.points,
      rarity: tierToRarity(row.tier),
      conditions: {},
      is_active: true,
      created_at: "",
      updated_at: "",
      is_unlocked: isUnlocked,
      unlocked_at: null,
      user_progress: {
        current_value: currentValue,
        target_value: targetValue,
        percentage,
        last_updated: new Date().toISOString(),
      },
    } as AchievementWithProgress;
  });

  const stats: AchievementStats = {
    total_achievements: achievements.length,
    unlocked_achievements: achievements.filter((a) => a.is_unlocked).length,
    total_points: achievements.filter((a) => a.is_unlocked).reduce((sum, a) => sum + a.points, 0),
    breakdown_by_category: {
      consumption: { total: 0, unlocked: 0, points: 0 },
      attendance: { total: 0, unlocked: 0, points: 0 },
      explorer: { total: 0, unlocked: 0, points: 0 },
      social: { total: 0, unlocked: 0, points: 0 },
      competitive: { total: 0, unlocked: 0, points: 0 },
      special: { total: 0, unlocked: 0, points: 0 },
      drinking: { total: 0, unlocked: 0, points: 0 },
      dedication: { total: 0, unlocked: 0, points: 0 },
    } as AchievementStats["breakdown_by_category"],
    breakdown_by_rarity: {
      common: { total: 0, unlocked: 0, points: 0 },
      rare: { total: 0, unlocked: 0, points: 0 },
      epic: { total: 0, unlocked: 0, points: 0 },
      legendary: { total: 0, unlocked: 0, points: 0 },
    },
  };

  achievements.forEach((achievement) => {
    const categoryBucket = stats.breakdown_by_category[achievement.category];
    const rarityBucket = stats.breakdown_by_rarity[achievement.rarity];

    if (categoryBucket) {
      categoryBucket.total++;
    }
    if (rarityBucket) {
      rarityBucket.total++;
    }

    if (achievement.is_unlocked) {
      if (categoryBucket) {
        categoryBucket.unlocked++;
        categoryBucket.points += achievement.points;
      }
      if (rarityBucket) {
        rarityBucket.unlocked++;
        rarityBucket.points += achievement.points;
      }
    }
  });

  return c.json({ data: achievements, stats }, 200);
});
```

Add near the top of `achievement.route.ts`:

```ts
import { SERIES } from "@prostcounter/shared/achievements";

import { AchievementMetricsRepository } from "../repositories/supabase/achievement-metrics.repository";
import { AchievementService } from "../services/achievement.service";

/**
 * Temporary bridge: the current UI still renders by rarity. Plan 2 drops the
 * rarity column and Plan 3 replaces the UI with tier frames. Until then, map
 * tier onto the rarity vocabulary the existing components expect.
 *
 * Takes `number | null` rather than a 1..4 union because `row.tier` comes from
 * the database as a nullable number and cannot be narrowed at the type level.
 */
function tierToRarity(tier: number | null): "common" | "rare" | "epic" | "legendary" {
  switch (tier) {
    case 2:
      return "rare";
    case 3:
      return "epic";
    case 4:
      return "legendary";
    default:
      return "common";
  }
}
```

- [ ] **Step 7: Run the full api test suite**

```bash
pnpm --filter=@prostcounter/api test
```

Expected: PASS. If `achievement.route.test.ts` fails because it asserts the old with-progress behaviour, read the failing assertion and update it to match the new engine — but STOP first and report what changed, because that test file may encode expectations the plan did not anticipate.

- [ ] **Step 8: Regenerate the API client**

```bash
pnpm --filter=@prostcounter/api generate-spec
pnpm --filter=@prostcounter/api-client generate
```

- [ ] **Step 9: Full verification**

```bash
pnpm lint
pnpm type-check
pnpm test
```

Expected: lint reports only the pre-existing warnings listed in Out of Scope, no errors. Type-check passes across all 7 packages. All tests pass.

- [ ] **Step 10: [HUMAN] Verify end to end in a running app**

Start the web app with `pnpm dev:web`, sign in as `user1@example.com` / `password`, and log a drink. Confirm:

1. The drink is logged successfully.
2. The `POST /consumption` response body contains an `unlocked` array (check the network tab).
3. The achievements page shows unlocked achievements with correct progress bars.

Then confirm in the database via `mcp__supabase-local__execute_sql`:

```sql
SELECT a.slug, a.tier, ua.festival_id, ua.unlocked_at
FROM user_achievements ua
JOIN achievements a ON a.id = ua.achievement_id
WHERE a.slug IS NOT NULL
ORDER BY ua.unlocked_at DESC LIMIT 10;
```

Expected: rows with new-style slugs. Lifetime unlocks show `festival_id = NULL`.

This step needs a browser and human eyes. An autonomous executor must stop here and report rather than marking the task complete.

- [ ] **Step 11: Commit**

```bash
git add packages/api packages/shared packages/api-client
git commit -m "feat(api): evaluate achievements on the write path"
```

---

## Done criteria for Plan 1

All of the following must be true before Plan 2 begins:

- [ ] `pnpm lint`, `pnpm type-check` and `pnpm test` all pass.
- [ ] `get_achievement_metrics` returns exactly 30 keys matching `AchievementMetrics`.
- [ ] The achievements table holds 90 new rows with slugs, plus the 41 untouched legacy rows.
- [ ] Logging a drink returns an `unlocked` array and writes `user_achievements` rows.
- [ ] The existing achievements screens on web and mobile still render without errors.
- [ ] `user_active_days` gains a row on authenticated requests.
- [ ] `festival_group_standings` is populated for every festival, with contiguous ranks per group.
- [ ] The legacy plpgsql engine is still present and untouched.

## Deploying Plan 1

Two steps have no migration or cron to run them automatically — found during the
final whole-branch review, where "populated locally" was mistaken for "populated,"
full stop. Do both once, after the migrations run, before calling Plan 1 live:

1. **Seed the registry.** `pnpm --filter=@prostcounter/api sync:achievements`
   against production (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set to the
   real project). Until this runs, `achievements` has only the 41 legacy rows,
   `GET /achievements/with-progress` returns an empty list, and nothing can
   unlock (`insertUnlocks` resolves zero slugs).
2. **Backfill standings for every past and current festival**, not just the
   active one — the nightly cron only ever refreshes the currently-active
   festival. For each festival: `SELECT refresh_festival_group_standings(id)
   FROM festivals;`. Without this, the two lifetime competitive series
   (`group_wins`, `podium_finishes` — 8 of 90 rungs) read an empty table for
   any festival that predates the cron ever running for it.

Neither step is destructive or repeatable-unsafe: both are idempotent
upserts/replacements, safe to re-run.
