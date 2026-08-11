# Achievements Revamp — Design

**Date:** 2026-08-05
**Status:** Approved, ready for planning
**Deadline:** Oktoberfest 2026 opens 2026-09-19 (6.5 weeks)

> **Superseded 2026-08-11.** This design shipped across five plans, all merged. Two
> things in it are wrong and were never built:
>
> - **§4 and §10 Step 3** describe `source`, `user_notified_at` and `group_notified_at`
>   columns on `user_achievements`. None of them exist. Notification state lives on the
>   `achievement_events` outbox instead, so the `source='backfill'` instruction describes
>   something that was never built.
> - **§10 Step 4's** drop list omits `get_user_achievements` and `unlock_achievement`; does
>   not note that `evaluate_user_achievements` was pinned by the live
>   `POST /achievements/evaluate` route; and does not note that
>   `insert_achievement_event_from_unlock`, `get_wrapped_data` and the `activity_feed` view
>   all read the `rarity` column it says to drop.
>
> Step 4 was completed separately on 2026-08-11 with those corrections. Every checkbox in
> the five plan documents is unticked despite the work having shipped: they were not
> maintained during execution, not left undone.

---

## 1. Why

The achievements feature is not dated, it is broken. Three independent regressions
have silently killed most of it, and production data confirms the damage.

### Production evidence (queried 2026-08-05)

- 41 active achievements. **18 have never been unlocked by any user, ever.**
- **Every consumption achievement stopped working on 2026-03-17.** Last unlock
  across all 12 of them: `2026-03-16`.
- Only 3 achievements have fired at all since April 2026: `festivalNewcomer`,
  `groupLeader`, `multiGroupChampion`.
- 377 users, 80 with attendance data, **51 have ever unlocked anything**.

### Root cause 1 — SQL matches on achievement names, which are now i18n keys

`check_achievement_conditions`, `calculate_achievement_progress` and
`evaluate_achievement_progress` all branch on the achievement's `name` column:

```sql
CASE achievement_record.name
  WHEN 'Festival Veteran' THEN ...
  WHEN 'High Roller' THEN ...
  ELSE RETURN false;
```

Migration `20260130214124_localize_achievements.sql` rewrote every name to a
translation key (`achievements.items.festivalVeteran.name`). Every `type:"special"`
achievement therefore falls through to `ELSE RETURN false` unconditionally.

The `LIKE` heuristics broke the same way and are case-sensitive:

| Pattern | Intended | Actual key | Matches? |
| --- | --- | --- | --- |
| `LIKE '%Photo%'` | Photo Enthusiast | `...photoEnthusiast.name` | No |
| `LIKE '%Daily%'` | Daily Double | `...dailyDouble.name` | No |
| `LIKE '%Power%'` | Power Hour | `...powerHour.name` | No |
| `LIKE '%Legend Status%'` | Legend Status | `...legendStatus.name` | No |
| `LIKE '%Session%'` | Serious Session | `...seriousSession.name` | Yes (accident) |
| `LIKE '%group%'` | group achievements | `...groupLeader.name` | Yes (accident) |

Where the pattern fails, the branch never assigns `current_value`, so it stays `0`
and the achievement is unreachable. Where it matches by accident, the semantics are
wrong (e.g. Power Hour falls into the `ELSE` branch and measures festival totals
instead of a single-day maximum, making it far easier than designed).

### Root cause 2 — consumption logic reads a column that is no longer written

All consumption metrics read `attendances.beer_count`. Migration
`20260317130000_stop_writing_beer_count.sql` stopped the RPCs writing to it; drinks
now live in the `consumptions` table.

Verified on local seed data: a user with 13 drinks across 4 days evaluates to
`current_value: 0` on all 12 consumption achievements.

### Root cause 3 — evaluation is never triggered by logging a drink

`trigger_evaluate_achievements` is attached to `attendances`, `beer_pictures`,
`group_members` and `tent_visits`. It is **not** attached to `consumptions`.
Logging a drink does not even attempt evaluation.

### Secondary defects

| Location | Defect |
| --- | --- |
| `achievement.repository.ts:28` | Selects column `condition`; the real column is `conditions`. |
| `apps/web/app/api/cron/scheduler/achievements.ts:48` | Group notifications fire for `rare` and `epic` but **not** `legendary`. The rarest unlocks are the quietest. |
| seed `wiesnWanderer` | `type:"variety"` with no `target_value` makes the comparison return SQL `NULL`, not `false`. |
| `AchievementBadge.tsx:35` + mobile card | Emoji `iconMap` duplicated across platforms. |
| `AchievementCard.tsx:48-49`, `AchievementBadge.tsx:112` | `t(name, { defaultValue: name })`, forbidden by `CLAUDE.md`. |
| `get_user_achievements` | Runs a full evaluation per achievement per page load: 41 evaluations per request, uncached. |
| `check_/calculate_/evaluate_` trio | ~600 lines of near-identical plpgsql that must stay in sync and does not. |

---

## 2. Decisions

| # | Decision | Choice |
| --- | --- | --- |
| D1 | Scope | Full revamp shipped before 2026-09-19 |
| D2 | Achievement scope model | Two explicit scopes: `festival` and `lifetime` |
| D3 | Engine location | TS definitions + SQL metrics + pure TS evaluator |
| D4 | Structure | Tiered series **plus** standalone one-offs |
| D5 | Categories | Six, organised by verb; `special` is retired |
| D6 | Prestige axis | Tier only (Bronze/Silver/Gold/Platinum), fixed 4 rungs; `rarity` dropped |
| D7 | Badge art | Composable SVG (frame + plate + glyph), placeholder glyphs + written art brief |
| D8 | Migration | Remap old unlocks to new series, then retroactively re-evaluate everyone |
| D9 | Unlock UX | Custom toast + existing confetti packages, no modal |
| D10 | Notification dedup | Client-acknowledged, with a 10-minute cron grace window |

---

## 3. Architecture

```
mutation (log drink / upload photo / add friend / join group / …)
        │
        ▼
  API repository writes
        │
        ▼
  achievementService.evaluate(userId, festivalId)
        │
        ├── SQL   get_achievement_metrics(user, festival) → jsonb   [ONE query]
        │           { drinks_total: 13, drinks_day_max: 5, days_attended: 4,
        │             tents_distinct: 4, photos: 2, friends: 3, litres_ml: 13000, … }
        │
        ├── TS    evaluate(metrics, DEFINITIONS) → { unlocked[], progress[] }
        │           pure function · zero I/O · unit tested with vitest
        │
        ├── SQL   insert missing rows into user_achievements
        │           (existing trigger writes achievement_events)
        │
        └── returns unlocked[] in the mutation response
                    │
                    ▼
        client: achievement toast + confetti
                    │
                    ▼
        POST /achievements/seen { eventIds }

  cron scheduler → Novu push (user channel, after grace window)
                 → Novu push (group channel, always)
                 → nightly sweep for cross-user unlocks
```

### Removed

- `check_achievement_conditions`
- `calculate_achievement_progress`
- `evaluate_achievement_progress`
- `evaluate_user_achievements`
- `trigger_evaluate_achievements` and its four triggers

### Added

- `get_achievement_metrics(p_user_id uuid, p_festival_id uuid) RETURNS jsonb`
- `packages/shared/src/achievements/` — definitions, glyph registry, evaluator
- `packages/api/src/services/achievement.service.ts` — orchestration
- `festival_group_standings` — materialized competitive standings
- `user_active_days` — activity tracking

### Why the write path, not triggers

Triggers were attractive because they need no call sites, but they are how root
cause 3 happened: a new write path (`consumptions`) was added and nobody remembered
the trigger. Evaluation on the write path is explicit, greppable, and returns the
unlock to the client so the toast can fire. The nightly sweep covers what the write
path cannot see: unlocks caused by *other people's* actions.

All writes already funnel through the Hono API (`consumption.repository.ts` is the
only writer of `consumptions`), so there is exactly one place per metric to hook.

---

## 4. Data model

### Registry

```sql
ALTER TABLE achievements
  ADD COLUMN slug      text NOT NULL,        -- stable key, matches TS definition id
  ADD COLUMN series_id text,                 -- 'drinks_total'; NULL for one-offs
  ADD COLUMN tier      smallint,             -- 1..4; NULL for one-offs
  ADD COLUMN scope     text NOT NULL         -- 'festival' | 'lifetime'
    CHECK (scope IN ('festival','lifetime'));

CREATE UNIQUE INDEX achievements_slug_key ON achievements (slug);
CREATE INDEX achievements_series_tier ON achievements (series_id, tier);

-- after migration completes:
ALTER TABLE achievements DROP COLUMN rarity;
```

`name` and `description` stop being meaningful DB values. They are derived i18n keys
(`achievements.<slug>.name` / `.description`), which removes the `defaultValue`
violations and makes missing translations a lint failure rather than a silent
English leak.

### Unlocks

```sql
ALTER TABLE user_achievements ALTER COLUMN festival_id DROP NOT NULL;
-- NULL festival_id == lifetime unlock

DROP INDEX user_achievements_user_id_achievement_id_festival_id_key;

-- PG 15.8 supports NULLS NOT DISTINCT, so no sentinel UUID is needed
ALTER TABLE user_achievements
  ADD CONSTRAINT user_achievements_unique
  UNIQUE NULLS NOT DISTINCT (user_id, achievement_id, festival_id);
```

### Activity tracking

```sql
CREATE TABLE user_active_days (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day           date NOT NULL,
  platform      text,              -- 'web' | 'ios' | 'android'
  app_version   text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, day)
);

CREATE INDEX user_active_days_day ON user_active_days (day);
```

Written fire-and-forget from the API auth middleware:

```sql
INSERT INTO user_active_days (user_id, day, platform, app_version)
VALUES ($1, current_date, $2, $3)
ON CONFLICT (user_id, day) DO UPDATE
  SET last_seen_at = now(), request_count = user_active_days.request_count + 1;
```

The promise is deliberately not awaited, so it adds no latency to any request.
Beyond feeding the two Dedication series, this gives DAU/WAU/MAU, retention
cohorts, and platform split — none of which are currently obtainable, since
`auth.users.last_sign_in_at` holds only the most recent value.

### Competitive standings

Past festivals are immutable once they end, so their standings are computed once
rather than replayed.

```sql
CREATE TABLE festival_group_standings (
  festival_id  uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  group_id     uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  rank         integer NOT NULL,
  member_count integer NOT NULL,
  criteria_id  integer NOT NULL,
  computed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (festival_id, group_id, user_id)
);

CREATE INDEX festival_group_standings_user_rank
  ON festival_group_standings (user_id, rank);
```

Refreshed by `refresh_festival_group_standings(p_festival_id)`, which wraps the
existing `get_group_leaderboard`. Called nightly for the active festival only, and
once more when a festival ends. Champion and Podium Regular then reduce to
index-only counts over `(user_id, rank)`.

### Notification dedup

```sql
ALTER TABLE achievement_events
  ADD COLUMN source            text NOT NULL DEFAULT 'sweep'
    CHECK (source IN ('sync','sweep','backfill')),
  ADD COLUMN user_notified_via text
    CHECK (user_notified_via IN ('in_app','push'));

CREATE INDEX achievement_events_pending_user
  ON achievement_events (created_at)
  WHERE user_notified_at IS NULL;
```

`achievement_events.rarity` is `NOT NULL` and drives the group-notification filter,
so D6 cannot simply drop rarity everywhere. It is replaced by `tier`:

```sql
ALTER TABLE achievement_events ADD COLUMN tier smallint;
-- backfill from the mapped achievement, then:
ALTER TABLE achievement_events ALTER COLUMN tier SET NOT NULL;
ALTER TABLE achievement_events DROP COLUMN rarity;
```

The group-notification filter changes from `IN ('rare','epic')` to `tier >= 3`
(gold and platinum), which also fixes the defect where `legendary` was excluded and
the rarest unlocks were the quietest.

Cron query changes to:

```sql
WHERE user_notified_at IS NULL
  AND created_at < now() - interval '10 minutes'
```

Failure analysis:

| Scenario | Outcome |
| --- | --- |
| Toast shown, ack received | No push. Correct. |
| Toast shown, ack lost | One redundant push after 10 min. Acceptable. |
| Response lost, no toast | Push after 10 min. Correct. |
| Unlock found by nightly sweep | Push. Correct, no toast was possible. |
| Backfilled row | Pre-stamped notified. No push. Correct. |

The `group_notified_at` channel is untouched: group members are told regardless of
whether the achiever saw a toast.

### Index additions

Verified as genuinely missing against production `pg_indexes` on 2026-08-05:

```sql
-- tent_visits has NO user_id index whatsoever; every Explorer metric seq-scans
CREATE INDEX idx_tent_visits_user_festival
  ON tent_visits (user_id, festival_id, tent_id);

-- photo_reactions' unique index leads with photo_id, unusable for WHERE user_id = ?
CREATE INDEX idx_photo_reactions_user
  ON photo_reactions (user_id);

-- groups.created_by is unindexed
CREATE INDEX idx_groups_created_by
  ON groups (created_by, festival_id);

-- the exact shape every metric uses; existing indexes lead (user_id, date)
CREATE INDEX idx_attendances_user_festival
  ON attendances (user_id, festival_id) INCLUDE (id, date);

-- REPLACES the existing idx_consumptions_attendance, which is on the same column.
-- Two indexes on (attendance_id) would be pure write overhead, so the old one is
-- dropped in the same migration.
DROP INDEX idx_consumptions_attendance;
CREATE INDEX idx_consumptions_attendance_covering
  ON consumptions (attendance_id)
  INCLUDE (drink_type, volume_ml, price_paid_cents, tip_cents, tent_id, recorded_at);
```

`get_achievement_metrics` is written as a single statement with CTEs so the planner
sees the whole shape at once, rather than a plpgsql function issuing serial queries.

---

## 5. Definitions

```ts
// packages/shared/src/achievements/types.ts
export type AchievementCategory =
  | "drinking" | "attendance" | "explorer"
  | "social" | "competitive" | "dedication";

export type AchievementScope = "festival" | "lifetime";
export type AchievementTier = 1 | 2 | 3 | 4; // bronze silver gold platinum

export interface AchievementSeries {
  id: string;                  // 'drinks_total'
  category: AchievementCategory;
  scope: AchievementScope;
  metric: MetricKey;           // keyof AchievementMetrics — compile-time checked
  glyph: GlyphId;
  tiers: [TierDef, TierDef, TierDef, TierDef];
}

export interface TierDef {
  tier: AchievementTier;
  target: number;
  points: number;
}

export interface AchievementOneOff {
  id: string;
  category: AchievementCategory;
  scope: AchievementScope;
  metric: MetricKey;
  op: "gte" | "eq" | "isTrue";
  target?: number;
  tier: AchievementTier;       // difficulty, drives the frame
  glyph: GlyphId;
  points: number;
}
```

`MetricKey` is `keyof AchievementMetrics`, and `AchievementMetrics` is the typed
shape returned by `get_achievement_metrics`. A definition referencing a metric that
does not exist is a type error, which is the whole point: this is the class of bug
that took the feature down.

Adding an achievement is one object plus three locale entries. No migration, no SQL.

### The evaluator

```ts
// pure, no I/O, fully unit testable
export function evaluate(
  metrics: AchievementMetrics,
  unlocked: Set<string>,
): { unlocked: UnlockedAchievement[]; progress: SeriesProgress[] }
```

Test coverage must include, at minimum: each metric at target-1 / target / target+1,
tier skipping (a user crossing three tiers in one action unlocks all three), lifetime
versus festival separation, and idempotency (re-running yields no new unlocks).

---

## 6. Content

Six categories, 20 series (4 tiers each) and 10 one-offs: **30 cards, 90 unlockable
rungs**, up from 41 flat badges of which 18 were unreachable.

### Drinking — what you drank

| Series | Metric | Bronze | Silver | Gold | Platinum |
| --- | --- | --- | --- | --- | --- |
| Maß Master | `drinks_total` | 3 | 10 | 25 | 50 |
| Big Day Out | `drinks_day_max` | 3 | 5 | 8 | 12 |
| Connoisseur | `drink_types_distinct` | 2 | 3 | 4 | 5 |
| By the Litre | `volume_ml_total` | 5 L | 20 L | 50 L | 100 L |
| Generous Soul | `tip_cents_total` | €5 | €20 | €50 | €100 |
| High Roller | `spend_cents_total` | €100 | €300 | €600 | €1000 |

One-off: **First Drop** — first drink ever logged (lifetime, bronze).

### Attendance — when you showed up

| Series | Metric | Bronze | Silver | Gold | Platinum |
| --- | --- | --- | --- | --- | --- |
| Stammgast | `days_attended` | 1 | 3 | 6 | 10 |
| On a Roll | `attendance_streak_max` | 2 | 3 | 5 | 7 |

One-offs: **Opening Day** (silver), **Closing Time** (silver),
**Weekend Warrior** — every weekend day of the festival (gold),
**The Full Wiesn** — every single day (platinum).

### Explorer — where you went

| Series | Metric | Scope | Bronze | Silver | Gold | Platinum |
| --- | --- | --- | --- | --- | --- | --- |
| Tent Hopper | `tents_distinct` | festival | 3 | 6 | 10 | 15 |
| Veteran | `festivals_attended` | lifetime | 1 | 3 | 5 | 8 |
| Beyond the Wiesn | `festival_types_distinct` | lifetime | 1 | 2 | 3 | 4 |

One-off: **All Fourteen** — visited every big tent at one Oktoberfest (platinum).

### Social — who you were with

| Series | Metric | Scope | Bronze | Silver | Gold | Platinum |
| --- | --- | --- | --- | --- | --- | --- |
| Team Player | `groups_joined` | festival | 1 | 2 | 4 | 6 |
| Good Company | `friends_accepted` | lifetime | 1 | 5 | 15 | 30 |
| Memory Keeper | `photos_uploaded` | festival | 1 | 10 | 25 | 50 |
| Hype Man | `reactions_given` | festival | 5 | 25 | 75 | 150 |

One-offs: **Say Prost** — first photo ever (lifetime, bronze),
**Ringleader** — created a group (silver).

### Competitive — how you ranked

| Series | Metric | Scope | Bronze | Silver | Gold | Platinum |
| --- | --- | --- | --- | --- | --- | --- |
| Champion | `group_wins` | lifetime | 1 | 3 | 6 | 10 |
| Podium Regular | `podium_finishes` | lifetime | 1 | 5 | 12 | 25 |

No one-offs. A "Day Leader" badge (topped a group leaderboard on any single day) was
considered and **cut**: it needs per-day standings rather than final standings, which
is an entire second materialization for one silver badge. Everything else in
Competitive is covered by the nightly refresh.

Both series read `festival_group_standings`. Groups of one are excluded
(`member_count >= 2`), otherwise Champion is free.

### Dedication — using the app

| Series | Metric | Scope | Bronze | Silver | Gold | Platinum |
| --- | --- | --- | --- | --- | --- | --- |
| Regular | `active_days_total` | lifetime | 5 | 25 | 75 | 200 |
| Devoted | `active_day_streak_max` | lifetime | 3 | 7 | 21 | 60 |
| Good Citizen | `crowd_reports` | festival | 1 | 5 | 15 | 30 |

One-offs: **Profile Complete** — avatar, username and full name set (lifetime, bronze),
**Year in Review** — viewed your Wrapped (lifetime, silver).

### Content notes

- Every metric except the Dedication activity pair reads data already stored.
- Naming above is English working copy. Final copy needs `en` / `de` / `es` in
  `packages/shared/src/i18n/locales/`, with correct umlauts and Spanish accents and
  inverted punctuation, per `CLAUDE.md`. That is 30 names + 30 descriptions + 4 tier
  labels + 6 category labels, times three languages.
- If the timeline tightens, **Competitive is the category to defer**: it is the only
  one requiring the standings materialization. Dropping it costs 2 series and removes
  a whole subsystem.

---

## 7. Badge system

```
       ╭───────────────╮     Layer 3   tier frame      4 SVGs, shared
       │  ╭─────────╮  │     Layer 2   category plate  6 tints from design tokens
       │  │  glyph  │  │     Layer 1   glyph           ~24 SVGs, one per series/one-off
       │  ╰─────────╯  │
       ╰───────────────╯
        BRONZE · SILVER · GOLD · PLATINUM
```

`packages/shared/src/achievements/glyphs.ts` exports raw geometry, not components:

```ts
export const GLYPHS = {
  masskrug: { viewBox: "0 0 48 48", paths: ["M12 14h20v22a6 6 0 0 1-6 6H18…"] },
  // …
} as const satisfies Record<string, Glyph>;
```

`packages/ui` exposes one component with two thin renderers:

```tsx
<AchievementBadge glyph="masskrug" tier="gold" category="drinking" locked={false} />
```

- Web renders `<svg><path d={…} /></svg>`
- Mobile renders `<Svg><Path d={…} /></Svg>` via `react-native-svg` (already installed)

This deletes the duplicated emoji `iconMap` from both platforms.

Locked state: same badge, 40% desaturation, frame stroked rather than filled. No
separate locked asset.

### Art brief (for real glyphs later)

Ships with placeholder glyphs derived from `lucide` paths, marked as placeholder in
code. Replacing them is editing one file; no logic changes.

Specification for the real set:

- **Canvas** 48×48 viewBox, artwork within a 40×40 safe area
- **Grid** 24px construction grid scaled 2×, so strokes land on whole pixels
- **Style** solid-fill silhouettes, not outlines. Must stay legible at 32px, which is
  the size used in the achievements grid and the unlock toast
- **Stroke** where strokes are unavoidable, 2px at 48×48, round caps and joins
- **Colour** single-path monochrome. Colour comes from the category plate underneath,
  so glyphs must never carry their own fill colours
- **Silhouette test** each glyph must be identifiable as a black shape on white with
  no interior detail
- **Count** ~24: one per series (20) plus distinct glyphs for the one-offs that
  cannot borrow a series glyph

Per-glyph descriptions belong in `docs/design/achievement-glyph-brief.md`, written as
part of implementation. Examples of the intended register: `masskrug` is a
one-litre stein with a hinged lid seen three-quarter on; `wiesn-crown` is a
Bavarian crown with a pretzel where the central cross would be; `tent-hop` is two
overlapping tent peaks with a dotted arc between them.

---

## 8. Screen UX

```
┌────────────────────────────────────────────────┐
│  Achievements                                  │
│  ┌──────────────────────┬───────────────────┐  │
│  │  ● This festival     │    All time       │  │  scope tabs (D2)
│  └──────────────────────┴───────────────────┘  │
│                                                │
│   1,240 pts        18/31 series      4 ⬥       │  header stats
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  58%            │
│                                                │
│  [All] [Drinking] [Attendance] [Explorer] …    │  category chips
│                                                │
│  ── CLOSE TO UNLOCKING ─────────────────────   │  ← new
│  ┌────────────────────────────────────────┐    │
│  │ ◈  Maß Master          GOLD  ●●●○      │    │
│  │    ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  22/25 · 3 to go │    │
│  └────────────────────────────────────────┘    │
│                                                │
│  ── DRINKING ───────────────────────────────   │
│  ┌──────────┬──────────┬──────────┐            │
│  │    ◈     │    ◈     │    ◇     │            │
│  │ Big Day  │Connoiss. │ By Litre │            │
│  │  SILVER  │  BRONZE  │  locked  │            │
│  │ ●●○○     │ ●○○○     │ ○○○○     │            │
│  └──────────┴──────────┴──────────┘            │
└────────────────────────────────────────────────┘
```

Changes from the current screen:

1. **Scope tabs** — required by D2; lifetime achievements have no festival home.
2. **"Close to unlocking" rail** — top 3 series by proximity to their next tier.
   This is the main behavioural addition. The current screen leads with a wall of
   grey locked cards and no indication of what is within reach.
3. **Series cards replace per-achievement cards** — 31 cards instead of 41+, each
   showing current tier, tier pips, and the next target.
4. **Detail sheet** — tapping a card shows all four rungs, which are earned, and the
   date each landed.
5. Category chips replace the web `SingleSelect` dropdown, matching mobile.

Both platforms follow the same information architecture. Web uses shadcn/ui +
Tailwind; mobile uses Gluestack + NativeWind with `VStack`/`HStack` and `space`,
per `CLAUDE.md`. Dynamic classNames go through `cn()` from `@prostcounter/ui`.

---

## 9. Unlock moment

Toast rather than modal, so rapid logging during a session is not interrupted.

| Platform | Toast | Confetti |
| --- | --- | --- |
| Web | `sonner` custom toast | `react-confetti-explosion` via existing `useConfetti` hook |
| Mobile | Gluestack `toast` | `react-native-confetti-cannon` |

All four packages are already installed. No new dependencies.

Rules:

- Confetti fires for **gold and platinum only**. Bronze and silver get the toast
  alone, otherwise it becomes noise during a heavy session.
- Simultaneous unlocks stack into a single toast: "3 unlocked".
- Toast render triggers `POST /achievements/seen { eventIds }` (see §4).
- Toast tap navigates to the achievements screen with that card focused.

---

## 10. Migration

Four ordered, independently reversible steps.

### Step 1 — Schema

Additive only: `slug`, `series_id`, `tier`, `scope` on `achievements`; nullable
`festival_id` on `user_achievements`; new tables `user_active_days` and
`festival_group_standings`; new indexes. Nothing dropped yet. Safe to deploy alone.

### Step 2 — Registry sync

Seed the 91 new achievement rows from the TS definitions, then map the 41 old rows
onto their new slugs, preserving `unlocked_at`.

```
firstDrop        → drinks_total · tier 1
beerRookie       → drinks_total · tier 2
halfwayThere     → drinks_total · tier 3
seriousDrinker   → drinks_total · tier 4
festivalVeteran  → festivals_attended · tier 2 (lifetime)
…
```

The complete 41-row mapping table is produced during implementation and committed
alongside the migration. Old achievements with no sensible new home
(e.g. `consistencyKing`) map to the nearest series tier or are dropped explicitly,
with the decision recorded per row rather than left implicit.

### Step 3 — Backfill re-evaluation

For every `(user, festival)` pair with data, compute metrics and insert missing
unlocks. `unlocked_at` is set to the earliest qualifying event where derivable, else
the original unlock date, else `now()`.

**Backfilled rows are inserted with `source='backfill'` and both
`user_notified_at` and `group_notified_at` pre-stamped.** Without this the cron
fires roughly 2000 push notifications at 51 users the moment it next runs.

Ships with `--dry-run`, which prints the per-user delta and writes nothing.

Expected outcome: no user loses a badge, and everyone retroactively receives the 18
achievements that were never reachable.

### Step 4 — Cleanup

Drop `check_achievement_conditions`, `calculate_achievement_progress`,
`evaluate_achievement_progress`, `evaluate_user_achievements`,
`trigger_evaluate_achievements` and its four triggers, and the `rarity` column.
Deployed only after step 3 is verified in production.

---

## 11. Testing

| Layer | Approach |
| --- | --- |
| Evaluator | vitest unit tests, pure function. Boundaries at target-1/target/target+1, multi-tier jumps, scope separation, idempotency. |
| Metrics SQL | Integration tests against local Supabase with seeded fixtures, asserting each metric key against known data. |
| Definitions | A test asserting every `metric` resolves, every `glyph` exists, every slug has `name`/`description` keys in all three locales, and tier targets are strictly increasing. |
| Migration | Dry-run diff on a production snapshot, reviewed before the real run. |
| Notification dedup | Integration test covering each row of the failure table in §4. |
| E2E | Update `e2e/specs/achievements.spec.ts` and `e2e/pages/achievements.page.ts` for the new IA. |

The definitions test is the safety net that would have caught the original outage:
it fails loudly if a definition points at anything that does not exist.

---

## 12. Out of scope

- Offline achievement evaluation. The mobile screen already shows `OfflineScreen`
  and this design keeps evaluation server-side.
- Achievement sharing images. The unlock toast offers no Share action in this design;
  generating a shareable badge card is a follow-up.
- Admin UI for editing achievements. Definitions live in TS by decision D3.
- Reworking the achievement points leaderboard beyond adapting it to the new points.

---

## 13. Open items for the plan

These are implementation artifacts to produce during planning, not unresolved design
questions.

1. The 41-row old→new mapping table, written out row by row and committed alongside
   the step 2 migration.
2. Final tier targets sanity-checked against the Oktoberfest 2025 distribution so
   Platinum is rare but reachable. The numbers in §6 are judgement calls and should
   be validated against real percentiles before they ship.
3. Per-glyph art brief descriptions (~24) for `docs/design/achievement-glyph-brief.md`.
