# Oktoberfest 2026 Data + Bulletin Email Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get Oktoberfest 2026 into production with correct tent data and coordinates, then send the already-drafted bulletin to 139 users with per-link and store-side attribution.

**Architecture:** One SQL migration creates the festival, inserts two new tents, replaces every fabricated tent coordinate with an OpenStreetMap-sourced one, and links 40 tents with 2026 prices. Separately, campaign parameters go on the three links in the two existing draft broadcasts, so attribution comes from the URLs themselves: GA4 for web sessions, Play Console and App Store Connect for installs. See the REVISION note below: the originally planned `news.prostcounter.fun` sending subdomain and Resend click tracking were dropped, and the existing `account.prostcounter.fun` sender stays as-is with tracking off.

**Tech Stack:** Supabase (Postgres + PostGIS), Supabase CLI, Resend MCP, Vercel CLI (DNS), Chrome DevTools MCP (App Store Connect), GA4.

**Stop-and-ask protocol:** If at any step you encounter state that contradicts the plan — file missing, function signature differs, test passes when expected to fail, unfamiliar code in target lines, dependency version unavailable, or any expectation in this plan does not match reality — STOP. Do not improvise, do not work around it, do not pick the closest interpretation. Report the discrepancy and wait for guidance.

## REVISION 2026-08-04: no separate sending domain, no click tracking

Task 5 could not be executed. Resend's free plan permits exactly one custom domain and
`account.prostcounter.fun` holds the slot, so `create-domain` returns
`403 "Your plan includes 1 domain. Upgrade to add more."`

Options were Resend Pro at 20 USD/month, a second provider for marketing mail (Brevo, Kit,
EmailOctopus and MailerLite were all checked; every free tier stamps its own branding on the
email), or dropping click tracking. The decision was to drop click tracking and stay free.

What this changes:

- **Task 5 is cancelled.** No `news.prostcounter.fun`, no DNS records, no tracking flags. Resend
  open and click tracking stay OFF everywhere, including on `account.prostcounter.fun`, which must
  remain untouched.
- **The From address stays `Ignacio from ProstCounter <ignacio@account.prostcounter.fun>`**, which is
  what the two already-approved test sends used. Tasks 7 and 8 must NOT change it.
- **No per-link click counts and no open rates.** Links are not rewritten, so Task 8 verifies the
  raw hrefs carry their parameters rather than verifying a tracking redirect preserves them.
- **The two-batch send stays.** The 100-per-day cap is a free-plan limit independent of domains.
- **Task 6 becomes materially more important.** Without click tracking, the Apple `pt`/`ct` link is
  the only way to learn anything about how the iOS button performed. Same for the Play `referrer`.

Measurement surfaces that survive: GA4 web sessions from the `utm_*` params, Play Console installs
from `referrer`, App Store Connect installs from `pt`/`ct`.

## Global Constraints

- Design doc: `docs/plans/2026-08-04-oktoberfest-2026-and-bulletin-tracking-design.md`. Read it before starting.
- Branch: `feat/oktoberfest-2026-and-bulletin-tracking`. Already created. Never commit to `main`.
- Do NOT push to the remote unless explicitly asked.
- Commit message titles are capped at 72 characters; the pre-commit hook enforces it.
- `pnpm lint` and `pnpm type-check` must pass before any commit. The pre-commit hook runs both.
- Festival dates are exactly `2026-09-19` to `2026-10-04`.
- Festival base beer price is exactly `1580` cents / `15.80` EUR.
- Campaign name is exactly `aug2026-whatsnew` everywhere it appears.
- No em-dashes in any user-facing copy (email body, subject, preview text). Use commas, colons, parentheses or hyphens.
- Existing email copy is already approved. Do not reword it. The only content change in this plan is adding parameters to three URLs.

## Open Questions Resolved

- **Question:** The spec said "align the remaining names with official 2026 naming", which is open-ended.
  **Decision:** Only fix the outright typo `Museumzelt` to `Museumszelt`. Leave all other tent names as they are, including `Paulaner Festzelt` (not `Winzerer Fähndl`) and `Pschorr-Festzelt Bräurosl` (not `Bräurosl`).
  **Why:** muenchen.de's own 2026 coverage uses "Paulaner-Festzelt", so our name is not wrong, just one of two accepted names. Renaming rows users already recognise has no functional benefit and risks confusing them. `Museumzelt` is a genuine misspelling with no defence.
  **If wrong:** STOP and ask. Do not rename additional tents on your own judgement.

- **Question:** The spec did not say what to do for tents with no published 2026 Maß price.
  **Decision:** They get NO row in `drink_type_prices` and therefore fall through to the festival default of 1580 cents. Their `festival_tents.beer_price_cents` is set to 1580.
  **Why:** A fabricated per-tent price is worse than an honest default, and `get_drink_price_cents` already falls back to the festival level.
  **If wrong:** STOP and ask.

- **Question:** The spec did not say what to do about the two tents with no coordinate source (`Münchner Weißbiergarten`, `Wiesn Guglhupf`).
  **Decision:** Set their `latitude` and `longitude` to `NULL`.
  **Why:** `get_nearby_tents` filters on `WHERE t.location IS NOT NULL`, so a NULL tent is silently excluded from proximity results. A wrong coordinate actively misleads someone standing on the Wiesn; an absent one just does not appear. Task 9 offers an optional manual placement.
  **If wrong:** STOP and ask. Do not invent coordinates for them.

- **Question:** Which UUIDs for the two new tents?
  **Decision:** `c0000000-0000-4000-b000-000000000001` (Bartls Flößerstadl) and `c0000000-0000-4000-b000-000000000002` (Hühnerbraterei Poschner).
  **Why:** Mirrors the deterministic-ID convention of `20260409174404_add_fruehlingsfest_2026.sql`, which used the `b0000000-...-b000-...` block. Deterministic IDs make the migration re-runnable and reviewable. The `4` version nibble and `b` variant nibble keep these valid UUIDs.
  **If wrong:** STOP and ask.

- **Question:** Is it safe to set `is_active = true` six weeks before the festival starts?
  **Decision:** Yes. Set `is_active = true` and `status = 'upcoming'` now.
  **Why:** Verified in code: `packages/shared/src/utils/festival-status.ts` derives status from dates at runtime, and `apps/web/app/(private)/home/FestivalStatus.tsx` renders a "starts in N days" info alert for a future festival. The DB `status` column is advisory (set by the admin UI), not the source of truth for display. The resulting UX is the desired "ready for the next Wiesn" state.
  **If wrong:** STOP and ask.

- **Question:** Which tents are in the 2026 lineup, given sources disagree?
  **Decision:** 40 tents, exactly as listed in the Task 1 table. Notably EXCLUDED: `Herzkasperlzelt` and `Zur Schönheitskönigin` (absent from the 2026 Oide Wiesn lineup), `Münchner Stubn` (replaced by Bartls Flößerstadl), and all venues belonging to other festivals (`Augustinerkeller`, `Löwenbräukeller`, `Paulaner am Nockherberg`, `Festhalle Bayernland`, `Hippodrom`, `Ayinger Braustuberl`, `Giesinger Bräu`).
  **Why:** Cross-referenced oktoberfest.de's official small-tent and Oide Wiesn pages against muenchen.de's 2026 changes article.
  **If wrong:** STOP and ask.

- **Question:** One price source lists `Bartls Flößerstadl` as a large tent at 15.70.
  **Decision:** Category `small`, price 1570.
  **Why:** muenchen.de and Falstaff both describe it as a small tent with 398 seats replacing Münchner Stubn. The price is single-sourced, hence the Task 1 human review.
  **If wrong:** STOP and ask.

- **Question:** Should `radler` be priced the same as `beer` per tent?
  **Decision:** Yes. Every per-tent override inserts both a `beer` and a `radler` row at the same price, which is why Task 3 expects 30 override rows for 15 differing tents.
  **Why:** This is exactly what `20260409174404_add_fruehlingsfest_2026.sql` did for Hippodrom. Note this is the per-tent _price_ only; the separate rule that a radler counts as half a beer for leaderboard purposes lives in `20260325120000_radler_half_beer_leaderboard.sql` and is untouched here.
  **If wrong:** STOP and ask.

- **Question:** The spec did not name a `map_url` for the festival row.
  **Decision:** `https://www.muenchen.de/en/events/oktoberfest`.
  **Why:** Prior festival rows use muenchen.de event pages, and this URL was confirmed live during research. A deep link to a year-specific map page risks 404ing later.
  **If wrong:** STOP and ask.

- **Question:** The spec did not name a path for the committed email HTML snapshot.
  **Decision:** `docs/email/2026-08-bulletin.html`, with an HTML comment at the top stating that Resend is the source of truth and this is a point-in-time snapshot.
  **Why:** `docs/` is tracked and already holds reference material. The comment keeps the drift risk explicit rather than implied.
  **If wrong:** STOP and ask.

- **Question:** What if the Apple provider token cannot be obtained in Task 6?
  **Decision:** Use the bare URL `https://apps.apple.com/app/prostcounter/id6758376527` with no query parameters at all.
  **Why:** Apple campaign attribution requires both `pt` and `ct`. A `ct` without `pt` attributes nothing while making the URL look tampered with. Per-link click counts still come from Resend regardless.
  **If wrong:** STOP and ask.

- **Question:** The plan writes a migration but there are no DB-level tests in this repo.
  **Decision:** Task 3's red/green cycle uses verification SQL rather than a test framework: the same query is run before the migration (expected: empty / wrong) and after (expected: exact values).
  **Why:** `packages/api/src/routes/__tests__/festival.route.test.ts` mocks Supabase entirely, so it cannot detect data problems. Verification SQL is the only thing that actually proves the migration. This is a deliberate deviation from strict TDD, noted per the discipline-drift rule.
  **If wrong:** STOP and ask.

## Out of Scope

- Marketing-consent or email-preference UI. Not built here.
- Routing any email through Novu. Novu keeps push and in-app only.
- New `/r/<slug>` redirect entries in `apps/web/app/(public)/r/[slug]/page.tsx`. Do not touch that file.
- A custom Resend tracking subdomain (branded click links).
- Enabling open or click tracking on `account.prostcounter.fun`. That domain must be left exactly as it is.
- Fixing coordinates for tents belonging to other festivals (`Augustinerkeller`, `Löwenbräukeller`, `Paulaner am Nockherberg`, `Festhalle Bayernland`, `Hippodrom`, `Ayinger Braustuberl`, `Giesinger Bräu`). They have NULL coordinates today. Leave them.
- Fixing `Starkbierfest 2026`'s inconsistent `short_name` ("Starkbierfest") or its NULL `default_beer_price_cents`.
- Rewording any approved email copy.
- Refactoring the duplicated `RedirectSlug` type across the three `/r/[slug]` files.
- Do not add features not listed in this plan, even if related code is nearby.

## Conventions

- Follow conventions established in `supabase/migrations/20260409174404_add_fruehlingsfest_2026.sql` and any `CLAUDE.md` in the project.
- SQL: lowercase keywords are NOT used in this repo's migrations; use uppercase `INSERT`/`UPDATE`/`SELECT` as the existing migrations do.
- Every migration statement gets a `-- Step N:` comment describing intent, matching the Frühlingsfest precedent.
- Apply migration SQL to the LOCAL database with the `mcp__supabase-local__execute_sql` tool during development. Do NOT run `pnpm sup:db:reset` casually; it wipes other agents' work on the shared local instance. The one full reset in Task 4 is deliberate and gated.

---

## File Structure

- `supabase/migrations/<generated_timestamp>_add_oktoberfest_2026.sql` — created in Task 2. The entire database change. Single transaction.
- `docs/email/2026-08-bulletin.html` — created in Task 7. Snapshot of the sent HTML.
- No application code changes. No TypeScript changes. `pnpm sup:db:types` is NOT needed because the schema does not change, only data.

---

## Task 1: [HUMAN] Approve the Oktoberfest 2026 reference table

No code. This is the review gate from the design doc. A wrong price is visible to every user and corrupts their spend statistics, so nothing may be written until a human signs off on this table.

**Files:** none.

**Interfaces:**

- Produces: an approved/rejected decision. Task 2 must not start until approval is explicit.

**Provenance:** prices from wiesnkini.de and in-muenchen.de (2026 tables); lineup from oktoberfest.de's small-tent and Oide Wiesn pages plus muenchen.de's 2026 changes article; coordinates from OpenStreetMap via the Overpass API (ODbL), `timestamp_osm_base: 2026-08-04`.

- [ ] **Step 1: Present the table below to the human and get explicit approval**

Flag these specific uncertainties out loud when presenting:

1. `Bartls Flößerstadl` price 15.70 is single-sourced, and that source miscategorised it as a large tent.
2. 25 of 40 tents have no published 2026 price and will inherit the 1580 base. They are marked `(base)`.
3. `Münchner Weißbiergarten` and `Wiesn Guglhupf` have no coordinate source and will be set to NULL.
4. `Museumszelt` price is 14.80 per the 2026 source, but a separate table listed 14.60 for 2025. Using 14.80.

**Large tents (14)**

| Tent ID                                | Name                      | Lat      | Lon      | Price        |
| -------------------------------------- | ------------------------- | -------- | -------- | ------------ |
| `55ff3af6-f1d6-481a-a8f4-58fa23f00f68` | Armbrustschützen Festzelt | 48.13474 | 11.54871 | 15.90        |
| `631abb99-4237-4bbc-94d7-2a6c18e11e25` | Augustiner-Festhalle      | 48.13286 | 11.55006 | 14.90        |
| `9eb72005-8026-4665-be77-4a61fbcc3fa1` | Festhalle Schottenhamel   | 48.13217 | 11.54814 | 15.80 (base) |
| `da36b13f-1e75-4299-9f75-1de4eb38b416` | Fischer-Vroni             | 48.13484 | 11.55018 | 15.75        |
| `282d326c-0e14-43e2-b8c6-9bf098a0fde6` | Hacker-Festzelt           | 48.13305 | 11.54816 | 15.80 (base) |
| `253eb29d-8efe-4095-9671-4eff02704c4a` | Hofbräu-Festzelt          | 48.13390 | 11.54841 | 15.80 (base) |
| `37ad3fc4-9d52-4e19-91c7-a01ed11c6854` | Käfer Wiesn-Schänke       | 48.13030 | 11.54729 | 15.80 (base) |
| `2661d289-5ecd-42a0-9a59-eaf5ef94f92d` | Kufflers Weinzelt         | 48.13006 | 11.54988 | 17.80        |
| `dd7b4b6d-7a57-411a-baf8-8c0d20682b64` | Löwenbräu-Festzelt        | 48.13098 | 11.54969 | 15.90        |
| `49449d2f-c9b7-4b8b-9ed7-889690493c3d` | Marstall-Festzelt         | 48.13537 | 11.54906 | 15.80 (base) |
| `017977ea-a9c3-4865-b494-edc49efc6212` | Ochsenbraterei            | 48.13412 | 11.55041 | 15.80 (base) |
| `0935a117-4fe2-46fb-b8fa-fc45d9496af9` | Paulaner Festzelt         | 48.13117 | 11.54788 | 15.80 (base) |
| `4d140654-f235-44b8-8d6e-8f23e57274a2` | Pschorr-Festzelt Bräurosl | 48.13195 | 11.54992 | 15.90        |
| `5deac267-6401-437f-adae-e81769e4e781` | Schützen-Festzelt         | 48.13124 | 11.54692 | 15.80 (base) |

**Oide Wiesn / `old` (4)**

| Tent ID                                | Name                         | Lat      | Lon      | Price        |
| -------------------------------------- | ---------------------------- | -------- | -------- | ------------ |
| `907342a2-ab22-4b27-8ebd-f7225a4d13e7` | Boandlkramerei               | 48.12876 | 11.54607 | 15.30        |
| `f2df3186-ec0d-467f-a560-fffa48a72897` | Festzelt Tradition           | 48.12863 | 11.54748 | 15.80 (base) |
| `655190b1-ca0d-4d5a-8def-74f8a20f1e2b` | Museumszelt _(renamed)_      | 48.12781 | 11.54727 | 14.80        |
| `e61d04d2-6a16-4069-bf79-85dcf4827c94` | Volkssängerzelt Schützenlisl | 48.12837 | 11.54617 | 14.90        |

**Small tents (22)**

| Tent ID                                | Name                             | Lat      | Lon      | Price        |
| -------------------------------------- | -------------------------------- | -------- | -------- | ------------ |
| `c0000000-0000-4000-b000-000000000001` | Bartls Flößerstadl _(NEW)_       | 48.13138 | 11.54925 | 15.70        |
| `bbbf2c29-7b2e-487a-bcfc-c4b75547f83a` | Bodo's Cafézelt & Cocktailbar    | 48.13340 | 11.55039 | 15.80 (base) |
| `1764c5e2-6f01-4119-a55a-7d0efe3ae861` | Café Theres'                     | 48.13222 | 11.55073 | 15.80 (base) |
| `28a517af-f440-4102-9ad3-beaed8347061` | Feisingers Kas- und Weinstubn    | 48.13135 | 11.54857 | 15.80 (base) |
| `f8e94181-3a63-4e68-9285-588038be343f` | Fisch-Bäda                       | 48.13144 | 11.55080 | 15.80 (base) |
| `6fcea9eb-c5c5-4d8f-9363-cbd86119128e` | Glöckle-Wirt                     | 48.13147 | 11.54852 | 15.80 (base) |
| `f02ae7eb-3c8c-4e38-ae4a-7b0f9fc5e404` | Goldener Hahn                    | 48.13325 | 11.54892 | 15.80 (base) |
| `6d4e022d-c033-4a56-a19b-441dfe8430fd` | Heimer Enten- und Hühnerbraterei | 48.13325 | 11.55104 | 15.80 (base) |
| `e2eae4f6-8da8-46db-b76a-d1fb50eca8f6` | Heinz Wurst- und Hühnerbraterei  | 48.13171 | 11.54857 | 15.80 (base) |
| `ecaae5eb-9745-4359-826a-9a14aa91591b` | Hochreiters Haxnbraterei         | 48.13343 | 11.54889 | 15.70        |
| `24b50db1-f7c1-4132-a07c-00ad2cb8c2e1` | Hühner- und Entenbraterei Ammer  | 48.13345 | 11.54979 | 14.95        |
| `c0000000-0000-4000-b000-000000000002` | Hühnerbraterei Poschner _(NEW)_  | 48.13266 | 11.54864 | 15.80 (base) |
| `2196e0ea-1262-4f2c-97ef-bcd67104ae72` | Kalbsbraterei                    | 48.13232 | 11.54938 | 15.80 (base) |
| `0898010d-693f-47be-b8f2-5916ad5a56d0` | Münchner Knödelei                | 48.12919 | 11.54917 | 15.80 (base) |
| `a20effb6-612e-4085-8de0-6fbc0dff1dc1` | Münchner Weißbiergarten          | NULL     | NULL     | 14.80        |
| `cb0a2849-159f-48f6-902f-fba73ae9c9a2` | Rischart's Café Kaiserschmarrn   | 48.13067 | 11.55050 | 15.80 (base) |
| `014c7c7e-f904-4fcc-931f-2b80c9ceff2b` | Schiebl's Kaffeehaferl           | 48.13416 | 11.54924 | 15.80 (base) |
| `949ee890-ee80-406c-af23-ded34e838b44` | Vinzenzmurr Metzger Stubn        | 48.13437 | 11.54922 | 15.80 (base) |
| `7b91d421-5052-4109-b47f-8136f3bb9a89` | Wiesn Guglhupf                   | NULL     | NULL     | 15.80 (base) |
| `5162f382-2321-495c-b723-942a4708811e` | Wildstuben                       | 48.13008 | 11.55243 | 15.80 (base) |
| `b349fe59-e104-42f1-9157-1859d829c1fa` | Wirtshaus im Schichtl            | 48.13387 | 11.55242 | 14.90        |
| `387574a0-8c63-4bf0-a4d0-a0bc37158ddd` | Zur Bratwurst                    | 48.13029 | 11.55261 | 15.70        |

**Sanity check to state when presenting:** the OSM coordinates put the Oide Wiesn tents (48.1278 to 48.1288) south of the main tents (48.1300 to 48.1354), which matches the real layout. The existing fabricated coordinates put them to the east, which is wrong.

- [ ] **Step 2: Record the outcome**

If approved, proceed to Task 2. If any cell is corrected, update the table in this plan file first, then proceed. If rejected, STOP.

---

## Task 2: Write the migration

**Pre-check:** Verify `supabase/migrations/20260409174404_add_fruehlingsfest_2026.sql` exists and `git branch --show-current` prints `feat/oktoberfest-2026-and-bulletin-tracking`. If not, STOP.

**Files:**

- Create: `supabase/migrations/<generated_timestamp>_add_oktoberfest_2026.sql`

**Interfaces:**

- Consumes: the approved table from Task 1.
- Produces: a migration file path, used by Tasks 3, 4 and 5.

- [ ] **Step 1: Generate the migration file**

```bash
pnpm sup:mig:new add_oktoberfest_2026
```

This prints the created path. Use that exact path for the next step. Do not rename it.

- [ ] **Step 2: Write the full migration**

Write exactly this content into the generated file:

```sql
-- Add Oktoberfest 2026 (191st Wiesn) and replace fabricated tent coordinates.
-- Dates: 19 September to 4 October 2026 (16 days).
--
-- Coordinates come from OpenStreetMap via the Overpass API (ODbL, snapshot 2026-08-04).
-- They replace the placeholder coordinates added in
-- 20260126000000_postgis_tent_coordinates.sql, which that migration's own comment called
-- "approximate": they were laid out along a synthetic diagonal and were wrong by up to ~900 m.
-- The existing tent_location_trigger keeps the PostGIS `location` column in sync from
-- latitude/longitude, so no geometry is written by hand here.

BEGIN;

-- Step 1: Only one festival may be active (idx_festivals_single_active is a unique partial
-- index), so clear the current holder before inserting. Frühlingsfest 2026 is active today
-- despite having ended in May.
UPDATE festivals SET is_active = false WHERE is_active = true;

-- Step 2: New tents for 2026.
-- Bartls Flößerstadl (398 seats) takes over the Münchner Stubn plot, so it inherits that
-- position. Münchner Stubn itself is not linked to 2026.
INSERT INTO tents (id, name, category, latitude, longitude) VALUES
  ('c0000000-0000-4000-b000-000000000001', 'Bartls Flößerstadl', 'small', 48.13138, 11.54925),
  ('c0000000-0000-4000-b000-000000000002', 'Hühnerbraterei Poschner', 'small', 48.13266, 11.54864)
-- ON CONFLICT guard matches the Frühlingsfest precedent. Note the whole migration is wrapped in
-- a transaction, so a failure rolls back entirely and there is no partial state to retry over.
-- The guard only matters if someone deletes the festival row by hand and re-runs this file.
ON CONFLICT (id) DO NOTHING;

-- Step 3: Fix the long-standing misspelling.
UPDATE tents SET name = 'Museumszelt'
WHERE id = '655190b1-ca0d-4d5a-8def-74f8a20f1e2b';

-- Step 4: Replace fabricated coordinates with OSM-sourced ones, for the 2026 lineup only.
-- Tents belonging to other festivals are deliberately untouched.
UPDATE tents AS t SET latitude = v.lat, longitude = v.lon
FROM (VALUES
  -- Large tents
  ('55ff3af6-f1d6-481a-a8f4-58fa23f00f68'::uuid, 48.13474, 11.54871), -- Armbrustschützen Festzelt
  ('631abb99-4237-4bbc-94d7-2a6c18e11e25'::uuid, 48.13286, 11.55006), -- Augustiner-Festhalle
  ('9eb72005-8026-4665-be77-4a61fbcc3fa1'::uuid, 48.13217, 11.54814), -- Festhalle Schottenhamel
  ('da36b13f-1e75-4299-9f75-1de4eb38b416'::uuid, 48.13484, 11.55018), -- Fischer-Vroni
  ('282d326c-0e14-43e2-b8c6-9bf098a0fde6'::uuid, 48.13305, 11.54816), -- Hacker-Festzelt
  ('253eb29d-8efe-4095-9671-4eff02704c4a'::uuid, 48.13390, 11.54841), -- Hofbräu-Festzelt
  ('37ad3fc4-9d52-4e19-91c7-a01ed11c6854'::uuid, 48.13030, 11.54729), -- Käfer Wiesn-Schänke
  ('2661d289-5ecd-42a0-9a59-eaf5ef94f92d'::uuid, 48.13006, 11.54988), -- Kufflers Weinzelt
  ('dd7b4b6d-7a57-411a-baf8-8c0d20682b64'::uuid, 48.13098, 11.54969), -- Löwenbräu-Festzelt
  ('49449d2f-c9b7-4b8b-9ed7-889690493c3d'::uuid, 48.13537, 11.54906), -- Marstall-Festzelt
  ('017977ea-a9c3-4865-b494-edc49efc6212'::uuid, 48.13412, 11.55041), -- Ochsenbraterei
  ('0935a117-4fe2-46fb-b8fa-fc45d9496af9'::uuid, 48.13117, 11.54788), -- Paulaner Festzelt
  ('4d140654-f235-44b8-8d6e-8f23e57274a2'::uuid, 48.13195, 11.54992), -- Pschorr-Festzelt Bräurosl
  ('5deac267-6401-437f-adae-e81769e4e781'::uuid, 48.13124, 11.54692), -- Schützen-Festzelt
  -- Oide Wiesn
  ('907342a2-ab22-4b27-8ebd-f7225a4d13e7'::uuid, 48.12876, 11.54607), -- Boandlkramerei
  ('f2df3186-ec0d-467f-a560-fffa48a72897'::uuid, 48.12863, 11.54748), -- Festzelt Tradition
  ('655190b1-ca0d-4d5a-8def-74f8a20f1e2b'::uuid, 48.12781, 11.54727), -- Museumszelt
  ('e61d04d2-6a16-4069-bf79-85dcf4827c94'::uuid, 48.12837, 11.54617), -- Volkssängerzelt Schützenlisl
  -- Small tents
  ('bbbf2c29-7b2e-487a-bcfc-c4b75547f83a'::uuid, 48.13340, 11.55039), -- Bodo's Cafézelt
  ('1764c5e2-6f01-4119-a55a-7d0efe3ae861'::uuid, 48.13222, 11.55073), -- Café Theres'
  ('28a517af-f440-4102-9ad3-beaed8347061'::uuid, 48.13135, 11.54857), -- Feisingers Kas- und Weinstubn
  ('f8e94181-3a63-4e68-9285-588038be343f'::uuid, 48.13144, 11.55080), -- Fisch-Bäda
  ('6fcea9eb-c5c5-4d8f-9363-cbd86119128e'::uuid, 48.13147, 11.54852), -- Glöckle-Wirt
  ('f02ae7eb-3c8c-4e38-ae4a-7b0f9fc5e404'::uuid, 48.13325, 11.54892), -- Goldener Hahn
  ('6d4e022d-c033-4a56-a19b-441dfe8430fd'::uuid, 48.13325, 11.55104), -- Heimer Enten- und Hühnerbraterei
  ('e2eae4f6-8da8-46db-b76a-d1fb50eca8f6'::uuid, 48.13171, 11.54857), -- Heinz Wurst- und Hühnerbraterei
  ('ecaae5eb-9745-4359-826a-9a14aa91591b'::uuid, 48.13343, 11.54889), -- Hochreiters Haxnbraterei
  ('24b50db1-f7c1-4132-a07c-00ad2cb8c2e1'::uuid, 48.13345, 11.54979), -- Hühner- und Entenbraterei Ammer
  ('2196e0ea-1262-4f2c-97ef-bcd67104ae72'::uuid, 48.13232, 11.54938), -- Kalbsbraterei
  ('0898010d-693f-47be-b8f2-5916ad5a56d0'::uuid, 48.12919, 11.54917), -- Münchner Knödelei
  ('cb0a2849-159f-48f6-902f-fba73ae9c9a2'::uuid, 48.13067, 11.55050), -- Rischart's Café Kaiserschmarrn
  ('014c7c7e-f904-4fcc-931f-2b80c9ceff2b'::uuid, 48.13416, 11.54924), -- Schiebl's Kaffeehaferl
  ('949ee890-ee80-406c-af23-ded34e838b44'::uuid, 48.13437, 11.54922), -- Vinzenzmurr Metzger Stubn
  ('5162f382-2321-495c-b723-942a4708811e'::uuid, 48.13008, 11.55243), -- Wildstuben
  ('b349fe59-e104-42f1-9157-1859d829c1fa'::uuid, 48.13387, 11.55242), -- Wirtshaus im Schichtl
  ('387574a0-8c63-4bf0-a4d0-a0bc37158ddd'::uuid, 48.13029, 11.55261)  -- Zur Bratwurst
) AS v(id, lat, lon)
WHERE t.id = v.id;

-- Step 5: Two 2026 tents have no trustworthy coordinate source. NULL them rather than keep
-- fabricated values: get_nearby_tents filters on `location IS NOT NULL`, so they are simply
-- omitted from proximity results instead of pointing users at the wrong place.
UPDATE tents SET latitude = NULL, longitude = NULL
WHERE id IN (
  'a20effb6-612e-4085-8de0-6fbc0dff1dc1', -- Münchner Weißbiergarten
  '7b91d421-5052-4109-b47f-8136f3bb9a89'  -- Wiesn Guglhupf
);

-- Step 6: The festival itself. status 'upcoming' matches the runtime value that
-- packages/shared/src/utils/festival-status.ts derives from the dates.
INSERT INTO festivals (
  name, short_name, festival_type, location,
  start_date, end_date, map_url,
  is_active, status, description,
  beer_cost, default_beer_price_cents,
  latitude, longitude
) VALUES (
  'Oktoberfest 2026',
  'oktoberfest-2026',
  'oktoberfest',
  'Munich, Germany',
  '2026-09-19',
  '2026-10-04',
  'https://www.muenchen.de/en/events/oktoberfest',
  true,
  'upcoming',
  'The 191st Oktoberfest on the Theresienwiese, 16 days from 19 September to 4 October 2026',
  15.80,
  1580,
  48.1314,
  11.5498
);

-- Step 7: Link the 40 tents of the 2026 lineup with their Maß prices. Tents with no published
-- 2026 price carry the 1580 base.
INSERT INTO festival_tents (festival_id, tent_id, beer_price, beer_price_cents)
SELECT
  (SELECT id FROM festivals WHERE short_name = 'oktoberfest-2026'),
  v.tent_id,
  v.cents / 100.0,
  v.cents
FROM (VALUES
  -- Large tents
  ('55ff3af6-f1d6-481a-a8f4-58fa23f00f68'::uuid, 1590), -- Armbrustschützen Festzelt
  ('631abb99-4237-4bbc-94d7-2a6c18e11e25'::uuid, 1490), -- Augustiner-Festhalle
  ('9eb72005-8026-4665-be77-4a61fbcc3fa1'::uuid, 1580), -- Festhalle Schottenhamel
  ('da36b13f-1e75-4299-9f75-1de4eb38b416'::uuid, 1575), -- Fischer-Vroni
  ('282d326c-0e14-43e2-b8c6-9bf098a0fde6'::uuid, 1580), -- Hacker-Festzelt
  ('253eb29d-8efe-4095-9671-4eff02704c4a'::uuid, 1580), -- Hofbräu-Festzelt
  ('37ad3fc4-9d52-4e19-91c7-a01ed11c6854'::uuid, 1580), -- Käfer Wiesn-Schänke
  ('2661d289-5ecd-42a0-9a59-eaf5ef94f92d'::uuid, 1780), -- Kufflers Weinzelt
  ('dd7b4b6d-7a57-411a-baf8-8c0d20682b64'::uuid, 1590), -- Löwenbräu-Festzelt
  ('49449d2f-c9b7-4b8b-9ed7-889690493c3d'::uuid, 1580), -- Marstall-Festzelt
  ('017977ea-a9c3-4865-b494-edc49efc6212'::uuid, 1580), -- Ochsenbraterei
  ('0935a117-4fe2-46fb-b8fa-fc45d9496af9'::uuid, 1580), -- Paulaner Festzelt
  ('4d140654-f235-44b8-8d6e-8f23e57274a2'::uuid, 1590), -- Pschorr-Festzelt Bräurosl
  ('5deac267-6401-437f-adae-e81769e4e781'::uuid, 1580), -- Schützen-Festzelt
  -- Oide Wiesn
  ('907342a2-ab22-4b27-8ebd-f7225a4d13e7'::uuid, 1530), -- Boandlkramerei
  ('f2df3186-ec0d-467f-a560-fffa48a72897'::uuid, 1580), -- Festzelt Tradition
  ('655190b1-ca0d-4d5a-8def-74f8a20f1e2b'::uuid, 1480), -- Museumszelt
  ('e61d04d2-6a16-4069-bf79-85dcf4827c94'::uuid, 1490), -- Volkssängerzelt Schützenlisl
  -- Small tents
  ('c0000000-0000-4000-b000-000000000001'::uuid, 1570), -- Bartls Flößerstadl
  ('bbbf2c29-7b2e-487a-bcfc-c4b75547f83a'::uuid, 1580), -- Bodo's Cafézelt
  ('1764c5e2-6f01-4119-a55a-7d0efe3ae861'::uuid, 1580), -- Café Theres'
  ('28a517af-f440-4102-9ad3-beaed8347061'::uuid, 1580), -- Feisingers Kas- und Weinstubn
  ('f8e94181-3a63-4e68-9285-588038be343f'::uuid, 1580), -- Fisch-Bäda
  ('6fcea9eb-c5c5-4d8f-9363-cbd86119128e'::uuid, 1580), -- Glöckle-Wirt
  ('f02ae7eb-3c8c-4e38-ae4a-7b0f9fc5e404'::uuid, 1580), -- Goldener Hahn
  ('6d4e022d-c033-4a56-a19b-441dfe8430fd'::uuid, 1580), -- Heimer Enten- und Hühnerbraterei
  ('e2eae4f6-8da8-46db-b76a-d1fb50eca8f6'::uuid, 1580), -- Heinz Wurst- und Hühnerbraterei
  ('ecaae5eb-9745-4359-826a-9a14aa91591b'::uuid, 1570), -- Hochreiters Haxnbraterei
  ('24b50db1-f7c1-4132-a07c-00ad2cb8c2e1'::uuid, 1495), -- Hühner- und Entenbraterei Ammer
  ('c0000000-0000-4000-b000-000000000002'::uuid, 1580), -- Hühnerbraterei Poschner
  ('2196e0ea-1262-4f2c-97ef-bcd67104ae72'::uuid, 1580), -- Kalbsbraterei
  ('0898010d-693f-47be-b8f2-5916ad5a56d0'::uuid, 1580), -- Münchner Knödelei
  ('a20effb6-612e-4085-8de0-6fbc0dff1dc1'::uuid, 1480), -- Münchner Weißbiergarten
  ('cb0a2849-159f-48f6-902f-fba73ae9c9a2'::uuid, 1580), -- Rischart's Café Kaiserschmarrn
  ('014c7c7e-f904-4fcc-931f-2b80c9ceff2b'::uuid, 1580), -- Schiebl's Kaffeehaferl
  ('949ee890-ee80-406c-af23-ded34e838b44'::uuid, 1580), -- Vinzenzmurr Metzger Stubn
  ('7b91d421-5052-4109-b47f-8136f3bb9a89'::uuid, 1580), -- Wiesn Guglhupf
  ('5162f382-2321-495c-b723-942a4708811e'::uuid, 1580), -- Wildstuben
  ('b349fe59-e104-42f1-9157-1859d829c1fa'::uuid, 1490), -- Wirtshaus im Schichtl
  ('387574a0-8c63-4bf0-a4d0-a0bc37158ddd'::uuid, 1570)  -- Zur Bratwurst
) AS v(tent_id, cents);

-- Step 8: Festival-level drink prices from the 1580 base, using the same ratios as
-- 20260409174404_add_fruehlingsfest_2026.sql.
DO $$
DECLARE
  v_festival_id uuid;
  v_base_price integer := 1580;
BEGIN
  SELECT id INTO v_festival_id FROM festivals WHERE short_name = 'oktoberfest-2026';

  INSERT INTO drink_type_prices (festival_id, drink_type, price_cents) VALUES
    (v_festival_id, 'beer', v_base_price),
    (v_festival_id, 'radler', v_base_price),
    (v_festival_id, 'alcohol_free', ROUND(v_base_price * 0.90)::integer),
    (v_festival_id, 'wine', ROUND(v_base_price * 0.85)::integer),
    (v_festival_id, 'soft_drink', ROUND(v_base_price * 0.40)::integer),
    (v_festival_id, 'other', v_base_price);
END $$;

-- Step 9: Per-tent beer and radler overrides, only where the tent price differs from the base.
INSERT INTO drink_type_prices (festival_tent_id, drink_type, price_cents)
SELECT ft.id, d.drink_type, ft.beer_price_cents
FROM festival_tents ft
CROSS JOIN (VALUES ('beer'::drink_type), ('radler'::drink_type)) AS d(drink_type)
WHERE ft.festival_id = (SELECT id FROM festivals WHERE short_name = 'oktoberfest-2026')
  AND ft.beer_price_cents <> 1580;

COMMIT;
```

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations
git commit -m "feat(db): add Oktoberfest 2026 with OSM tent coordinates"
```

---

## Task 3: Verify the migration against local

**Pre-check:** Verify local Supabase is running (`pnpm sup:start` if not) and that the migration file from Task 2 exists. If not, STOP.

**Files:** none created. Read-only verification plus one migration application.

**Interfaces:**

- Consumes: the migration file from Task 2.
- Produces: confirmation that the SQL is correct. Task 4 depends on this passing.

- [ ] **Step 1: Run the verification query BEFORE applying, to confirm it fails**

Run with `mcp__supabase-local__execute_sql`:

```sql
SELECT
  (SELECT count(*) FROM festivals WHERE short_name = 'oktoberfest-2026') AS festival_exists,
  (SELECT count(*) FROM festival_tents ft JOIN festivals f ON f.id = ft.festival_id
   WHERE f.short_name = 'oktoberfest-2026') AS linked_tents;
```

Expected: `festival_exists = 0`, `linked_tents = 0`.

If `festival_exists` is already 1, the migration was partly applied. STOP.

- [ ] **Step 2: Apply the migration to local**

Paste the full migration body from Task 2 Step 2 into `mcp__supabase-local__execute_sql`.

Expected: success, no error. If it raises a unique violation on `idx_festivals_single_active`, Step 1 of the migration did not run; STOP and report.

- [ ] **Step 3: Run the verification query again, expecting exact values**

```sql
SELECT
  (SELECT count(*) FROM festivals WHERE short_name = 'oktoberfest-2026') AS festival_exists,
  (SELECT count(*) FROM festivals WHERE is_active) AS active_count,
  (SELECT short_name FROM festivals WHERE is_active) AS active_festival,
  (SELECT count(*) FROM festival_tents ft JOIN festivals f ON f.id = ft.festival_id
   WHERE f.short_name = 'oktoberfest-2026') AS linked_tents,
  (SELECT count(*) FROM festival_tents ft JOIN festivals f ON f.id = ft.festival_id
   WHERE f.short_name = 'oktoberfest-2026' AND ft.beer_price_cents IS NULL) AS tents_missing_price,
  (SELECT count(*) FROM drink_type_prices dtp JOIN festivals f ON f.id = dtp.festival_id
   WHERE f.short_name = 'oktoberfest-2026') AS festival_drink_prices,
  (SELECT count(*) FROM drink_type_prices dtp JOIN festival_tents ft ON ft.id = dtp.festival_tent_id
   JOIN festivals f ON f.id = ft.festival_id WHERE f.short_name = 'oktoberfest-2026') AS tent_overrides,
  (SELECT count(*) FROM tents WHERE name = 'Museumzelt') AS old_typo_remaining,
  (SELECT count(*) FROM tents t JOIN festival_tents ft ON ft.tent_id = t.id
   JOIN festivals f ON f.id = ft.festival_id
   WHERE f.short_name = 'oktoberfest-2026' AND t.location IS NULL) AS tents_without_geometry;
```

Expected exactly:

| Column                   | Expected           |
| ------------------------ | ------------------ |
| `festival_exists`        | 1                  |
| `active_count`           | 1                  |
| `active_festival`        | `oktoberfest-2026` |
| `linked_tents`           | 40                 |
| `tents_missing_price`    | 0                  |
| `festival_drink_prices`  | 6                  |
| `tent_overrides`         | 30                 |
| `old_typo_remaining`     | 0                  |
| `tents_without_geometry` | 2                  |

`tent_overrides` is 30 because 15 tents differ from the 1580 base and each gets a `beer` and a `radler` row. `tents_without_geometry` is 2: Münchner Weißbiergarten and Wiesn Guglhupf.

Any mismatch: STOP and report which column differed.

Caveat on `active_count`: the local Supabase instance is shared, and its seed data may carry
additional festivals. If `active_count` is not 1, report which other festival is active rather
than assuming the migration failed. `active_festival` must still be `oktoberfest-2026`.

- [ ] **Step 4: Confirm the trigger populated PostGIS geometry**

```sql
SELECT t.name, t.latitude, t.longitude,
       extensions.ST_AsText(t.location) AS geom
FROM tents t
WHERE t.id IN (
  '49449d2f-c9b7-4b8b-9ed7-889690493c3d',
  'c0000000-0000-4000-b000-000000000001'
);
```

Expected: Marstall-Festzelt at `48.13537, 11.54906` with geom `POINT(11.54906 48.13537)`, and Bartls Flößerstadl at `48.13138, 11.54925` with geom `POINT(11.54925 48.13138)`. Note longitude comes first in WKT.

If `geom` is NULL, `tent_location_trigger` did not fire. STOP.

- [ ] **Step 5: Confirm price resolution works end to end**

```sql
SELECT
  t.name,
  ft.beer_price_cents,
  public.get_drink_price_cents(f.id, t.id, 'beer'::drink_type) AS resolved_beer,
  public.get_drink_price_cents(f.id, t.id, 'soft_drink'::drink_type) AS resolved_soft
FROM festival_tents ft
JOIN tents t ON t.id = ft.tent_id
JOIN festivals f ON f.id = ft.festival_id
WHERE f.short_name = 'oktoberfest-2026'
  AND t.id IN (
    '2661d289-5ecd-42a0-9a59-eaf5ef94f92d', -- Kufflers Weinzelt, override 1780
    '9eb72005-8026-4665-be77-4a61fbcc3fa1'  -- Schottenhamel, base 1580
  )
ORDER BY t.name;
```

Expected: Kufflers Weinzelt `resolved_beer = 1780`, Schottenhamel `resolved_beer = 1580`, both `resolved_soft = 632`.

The signature was verified against production during planning as
`get_drink_price_cents(p_festival_id uuid, p_tent_id uuid DEFAULT NULL, p_drink_type drink_type DEFAULT 'beer')`,
so the positional call above is correct. If local reports a different signature, STOP and report it rather than guessing.

---

## Task 4: [HUMAN] Prove the full migration chain, then push to production

Human-gated because `pnpm sup:db:reset` wipes the shared local instance other agents may be using, and `pnpm sup:db:push` writes to production.

**Pre-check:** Task 3 passed with every expected value matching. If not, STOP.

**Files:** none.

**Interfaces:**

- Consumes: verified migration from Task 3.
- Produces: Oktoberfest 2026 live in production.

- [ ] **Step 1: [HUMAN] Confirm nobody else is using the local Supabase instance**

Ask before running the reset. If unsure, STOP.

- [ ] **Step 2: Prove the whole chain replays cleanly**

```bash
pnpm sup:db:reset
```

Expected: completes with no error, all migrations applied in order.

If it fails on the new migration, the SQL is order-dependent in a way Task 3 masked (Task 3 applied it to an already-migrated DB). STOP and report the error.

- [ ] **Step 3: Re-run the Task 3 Step 3 verification query against local**

Expected: the same nine values as Task 3 Step 3. Seed data may add festivals, so if `active_count` is not 1, report what else is active rather than assuming.

- [ ] **Step 4: [HUMAN] Push to production**

```bash
pnpm sup:db:push
```

Review the list of migrations it intends to apply before confirming. It should be only the new `add_oktoberfest_2026` file. If it wants to apply anything else, STOP.

- [ ] **Step 5: Verify production**

Run the Task 3 Step 3 verification query with `mcp__supabase-remote__execute_sql`. Expected: identical nine values.

- [ ] **Step 6: [HUMAN] Confirm the app renders correctly**

Load the app, check the home screen shows a "starts in N days" info alert naming Oktoberfest 2026, and that the tent list is populated. If it shows Frühlingsfest or an error, STOP.

---

## Task 5: CANCELLED — create the news. sending domain with tracking

**Do not execute this task.** See the REVISION note at the top of this plan. Resend's free plan caps
the account at one custom domain and `account.prostcounter.fun` holds it. Nothing in this task ran:
no domain was created, no DNS records were added, and no tracking flags were changed on any domain.

`account.prostcounter.fun` must keep Open Tracking and Click Tracking both `false`. Do not call
`mcp__resend__update-domain` against it under any circumstances.

The original steps are retained below for the record only.

### Original (not to be executed)

**Pre-check:** Confirm with `mcp__resend__list-domains` that `account.prostcounter.fun` still shows `Open Tracking: false` and `Click Tracking: false`. If either is true, someone changed it; STOP.

**Files:** none.

**Interfaces:**

- Produces: a verified `news.prostcounter.fun` domain ID, consumed by Task 7.

- [ ] **Step 1: Create the domain**

Call `mcp__resend__create-domain` with name `news.prostcounter.fun` and region `eu-west-1`.

Record the returned domain ID and the full DNS record list. The records will follow the pattern already present for `account.`: a DKIM `TXT` at `resend._domainkey.news`, an SPF `TXT` at `send.news`, and an `MX` at `send.news` pointing to `feedback-smtp.eu-west-1.amazonses.com` with priority 10.

- [ ] **Step 2: Add each returned DNS record via the Vercel CLI**

Use the values Resend returned, not the illustrative ones below. The command shape is
`vercel dns add <domain> <subdomain> <type> <value> [priority]`:

```bash
vercel dns add prostcounter.fun resend._domainkey.news TXT "<dkim-value-from-resend>"
vercel dns add prostcounter.fun send.news TXT "v=spf1 include:amazonses.com ~all"
vercel dns add prostcounter.fun send.news MX feedback-smtp.eu-west-1.amazonses.com 10
```

If Resend returns a record whose name, type or value differs from this shape, use Resend's version and note the difference. If it returns a fourth record, add it too.

- [ ] **Step 3: Confirm the records resolve**

```bash
dig +short TXT resend._domainkey.news.prostcounter.fun
dig +short TXT send.news.prostcounter.fun
dig +short MX send.news.prostcounter.fun
```

Expected: each returns the value just added. Vercel DNS propagates in seconds; if still empty after two minutes, STOP.

- [ ] **Step 4: Verify the domain in Resend**

Call `mcp__resend__verify-domain` with the domain ID, then `mcp__resend__get-domain` to check status.

Expected: status `verified`. If `pending` after a few minutes, re-check. If `failed`, STOP.

- [ ] **Step 5: Enable open and click tracking on the new domain only**

Call `mcp__resend__update-domain` with the `news.prostcounter.fun` domain ID, `openTracking: true`, `clickTracking: true`.

Do NOT pass a `trackingSubdomain`. Do NOT call update-domain against `account.prostcounter.fun`.

- [ ] **Step 6: Confirm both domains are in the right state**

Call `mcp__resend__list-domains`.

Expected: `news.prostcounter.fun` verified with both tracking flags true, AND `account.prostcounter.fun` still with both flags false. If `account.` changed, STOP immediately; that affects password resets.

---

## Task 6: [HUMAN] Obtain the Apple campaign link

Human-gated: requires an authenticated App Store Connect session and interactive navigation.

**Files:** none.

**Interfaces:**

- Produces: either a provider token (`pt`) value, or an explicit "no token" outcome. Consumed by Task 7.

- [ ] **Step 1: [HUMAN] Navigate to the campaign generator**

Using the `mcp__chrome-devtools-existing__*` tools against the already-authenticated browser, go to App Store Connect, then App Analytics for ProstCounter, then Acquisition, then Campaigns.

- [ ] **Step 2: [HUMAN] Create a campaign named `aug2026-whatsnew` and copy the generated link**

The generated link has the shape
`https://apps.apple.com/app/prostcounter/id6758376527?pt=<provider-token>&ct=aug2026-whatsnew&mt=8`.

Record the exact link.

- [ ] **Step 3: Record the outcome for Task 7**

If a link was obtained, Task 7 uses it verbatim. If the campaign generator is not available on this account, record "no Apple token" and Task 7 uses the bare URL `https://apps.apple.com/app/prostcounter/id6758376527` with no parameters, per Open Questions Resolved. Do not construct a `ct`-only URL.

---

## Task 7: Add campaign parameters to both broadcasts

**Pre-check:** Confirm both draft broadcasts still exist and are `status: draft` via `mcp__resend__list-broadcasts`. If either is `sent`, STOP. Task 5 is cancelled and is NOT a prerequisite; see the REVISION note at the top of this plan.

**Files:** none. The HTML snapshot file is created in Task 8.

**Interfaces:**

- Consumes: the Apple link decision from Task 6.
- Produces: two updated draft broadcasts, ready to send in Tasks 8 and 9. The final HTML body, consumed by Task 8 Step 5.

The three URLs, used in both the HTML and plain-text bodies:

- Web: `https://prostcounter.fun/?utm_source=email&utm_medium=bulletin&utm_campaign=aug2026-whatsnew&utm_content=web`
- Play: `https://play.google.com/store/apps/details?id=com.prostcounter.app&referrer=utm_source%3Demail%26utm_medium%3Dbulletin%26utm_campaign%3Daug2026-whatsnew`
- Apple: the Task 6 link, or the bare URL if no token.

- [ ] **Step 1: Fetch the current HTML and text of Batch 1**

Call `mcp__resend__get-broadcast` with `d193c030-d7a4-4ff9-b42c-93dc3bdf2940`. Save both bodies locally so the only diff you introduce is the URLs.

- [ ] **Step 2: Replace the three URLs in both bodies**

In the HTML there are FIVE occurrences to change, not three, because the App Store and Play buttons each appear twice: once in an `<!--[if mso]>` VML `<v:roundrect href="...">` block for Outlook and once in the normal `<a href="...">`. Update every one.

Occurrences to replace:

1. `<v:roundrect ... href="https://apps.apple.com/app/prostcounter/id6758376527"` → Apple link
2. `<a href="https://apps.apple.com/app/prostcounter/id6758376527"` → Apple link
3. `<v:roundrect ... href="https://play.google.com/store/apps/details?id=com.prostcounter.app"` → Play link
4. `<a href="https://play.google.com/store/apps/details?id=com.prostcounter.app"` → Play link
5. `<a href="https://prostcounter.fun"` → web link

In the plain text, replace the three bare URLs on the "Get it on the App Store:", "Get it on Google Play:" and "Open ProstCounter on the web:" lines.

Change nothing else. Do not touch `{{{FIRST_NAME|there}}}` or `{{{RESEND_UNSUBSCRIBE_URL}}}`.

Note: the Play URL already contains a `?`, so `referrer` is appended with `&`. The web URL has no query string, so it uses `/?`.

- [ ] **Step 3: Update Batch 1**

Call `mcp__resend__update-broadcast` with:

- `broadcastId`: `d193c030-d7a4-4ff9-b42c-93dc3bdf2940`
- `from`: `Ignacio from ProstCounter <ignacio@account.prostcounter.fun>`
- `segmentId`: `ab9269de-d777-42e3-a22e-3c67fe0d589b`
- `html` and `text`: the updated bodies

`from` and `segmentId` must be included even though they are already set; the API requires them on update. The `from` value above is UNCHANGED from what the broadcast already carries, and it must stay that way: there is no `news.` domain. Do not invent a different sender.

- [ ] **Step 4: Update Batch 2 with the identical bodies**

Same call, with:

- `broadcastId`: `455968b3-3358-46fa-95c6-bc01fe2dae87`
- `segmentId`: `e998142d-d562-4a5a-8778-8a582253ec20`
- same `from`, `html`, `text`

- [ ] **Step 5: Verify both broadcasts**

Call `mcp__resend__get-broadcast` for each ID. Confirm for both: `from` is still `Ignacio from ProstCounter <ignacio@account.prostcounter.fun>`, the subject is unchanged (`ProstCounter now has real apps (and a few other things worth checking out)`), all five HTML URLs carry parameters, and status is still `draft`.

The HTML snapshot is deliberately NOT written in this task. It lives in Task 8 Steps 5 and 6, after
the test send has proven the HTML renders, so the committed snapshot can never be a version that was
found broken and then changed.

---

## Task 8: [HUMAN] Test send and verify tracking

Human-gated: requires reading a real inbox and judging rendering.

**Pre-check:** Task 7 Step 5 passed. If not, STOP.

**Files:**

- Create: `docs/email/2026-08-bulletin.html`

- [ ] **Step 1: Send a test to the author's own address**

Use `mcp__resend__send-email` with `from: Ignacio from ProstCounter <ignacio@account.prostcounter.fun>`, `to: ignacioguri@gmail.com`, the exact subject and HTML from the updated broadcast.

Note: a direct send will not include the `{{{FIRST_NAME|there}}}` or `{{{RESEND_UNSUBSCRIBE_URL}}}` substitutions, which only resolve for broadcasts. Replace those two tokens with `there` and `https://example.com/unsub` for the test only. Do not save that version anywhere.

- [ ] **Step 2: [HUMAN] Check the delivered email**

Confirm: header renders with the yellow background and the app icon loads; body text is unchanged; all three buttons render; nothing shows a raw template token.

- [ ] **Step 3: [HUMAN] Verify each link carries its parameters**

Click tracking is OFF, so hrefs are NOT rewritten. Each button's href should be the raw destination
with its parameters visible on hover or long-press. That is the expected state; a Resend tracking URL
here would mean click tracking got enabled on `account.prostcounter.fun` by mistake, which is a STOP
condition because it puts password-reset links at risk.

Confirm each href and then that each click lands correctly:

- web link carries all four `utm_*` params
- Play link carries `referrer` with its URL-encoded UTMs
- Apple link carries `pt`/`ct`/`mt`, if Task 6 produced a token

If a link lands without its parameters, STOP. Store-side attribution is the only iOS and Android
signal we have left, so a dropped parameter loses the measurement entirely and silently.

- [ ] **Step 4: Confirm the send is healthy in Resend**

Call `mcp__resend__list-emails` with `limit: 5`. Expected: the test email present with status `delivered`. If `bounced` or `complained`, STOP.

- [ ] **Step 5: Write the HTML snapshot to the repo**

Only now that the HTML is proven to render. Use the broadcast HTML from Task 7, with the template
tokens `{{{FIRST_NAME|there}}}` and `{{{RESEND_UNSUBSCRIBE_URL}}}` intact — NOT the substituted
test-send variant from Step 1.

Create `docs/email/2026-08-bulletin.html` prefixed with:

```html
<!--
  Snapshot of the August 2026 "what's new" bulletin, as sent.
  Resend is the source of truth for what actually shipped; this file is a
  point-in-time copy kept so a future bulletin starts from an edit rather than
  a rebuild. It is not read by any code and is not kept in sync automatically.

  Campaign: aug2026-whatsnew
  Sent from: ignacio@account.prostcounter.fun
  Tracking: none at the provider (Resend open/click tracking off). Attribution is
            via URL parameters only: utm_* for GA4, referrer for Play, pt/ct for Apple.
  Broadcasts: d193c030-d7a4-4ff9-b42c-93dc3bdf2940 (batch 1),
              455968b3-3358-46fa-95c6-bc01fe2dae87 (batch 2)
-->
```

- [ ] **Step 6: Commit**

```bash
git add docs/email/2026-08-bulletin.html
git commit -m "docs(email): snapshot Aug 2026 bulletin with campaign params"
```

---

## Task 9: [HUMAN] Send both batches and verify delivery

Human-gated: irreversible outward-facing send to 139 real people. Requires explicit go-ahead immediately before each send, not carried over from earlier approval.

**Pre-check:** Task 4 finished (Oktoberfest 2026 live in production) AND Task 8 passed. Both are required. The email drives people into the app, so the festival must be correct before anyone clicks. If Task 4 is incomplete, STOP.

**Files:** none.

- [ ] **Step 1: [HUMAN] Get explicit go-ahead for Batch 1**

Confirm the human wants Batch 1 (96 recipients) sent now. Do not proceed on prior approval alone.

- [ ] **Step 2: Send Batch 1**

Call `mcp__resend__send-broadcast` with `broadcastId: d193c030-d7a4-4ff9-b42c-93dc3bdf2940` and no `scheduledAt`.

- [ ] **Step 3: Verify Batch 1 went out**

Call `mcp__resend__get-broadcast` on the same ID. Expected: status is no longer `draft`, and `sent_at` is populated.

Then `mcp__resend__list-emails` with `limit: 100`. Check the delivered-to-bounced ratio. A handful of bounces on a lapsed list is normal; more than roughly 10 percent is not. If bounces are high, STOP before scheduling Batch 2.

- [ ] **Step 4: Schedule Batch 2 for roughly 26 hours later**

Call `mcp__resend__send-broadcast` with `broadcastId: 455968b3-3358-46fa-95c6-bc01fe2dae87` and `scheduledAt: "in 26 hours"`.

26 hours rather than 24 because the free tier caps at 100 emails per day and PAUSES rather than queueing once hit. Batch 1 uses 96 of today's 100, so the buffer matters.

- [ ] **Step 5: Confirm Batch 2 is scheduled**

Call `mcp__resend__get-broadcast` on the Batch 2 ID. Expected: `scheduled_at` populated roughly 26 hours out, status `scheduled`.

- [ ] **Step 6: [HUMAN] Verify Batch 2 after it fires**

More than 26 hours later, call `mcp__resend__get-broadcast` and `mcp__resend__list-emails`. Confirm Batch 2 sent and delivery is healthy.

- [ ] **Step 7: [HUMAN] Optional follow-up, place the two missing tents**

`Münchner Weißbiergarten` and `Wiesn Guglhupf` have NULL coordinates. If wanted, read their positions off the official Wiesn map and write a small follow-up migration. Not required for this plan to be complete.

---

## Task 10: Oktoberfest 2026 reference doc for future blog use

Order-independent: can run any time after Task 1. Not a dependency of any other task.

**Files:**

- Create: `docs/festivals/oktoberfest-2026-reference.md`

**Interfaces:**

- Consumes: the approved tables in Task 1 of this plan file.
- Produces: nothing other tasks depend on.

Purpose: preserve the researched data and its provenance as raw material for a future blog post. This is a reference document, NOT a blog article. Do not write it to `apps/web/content/blog/`, do not add MDX frontmatter, and do not produce de/es translations. Those rules apply to real blog articles under `docs/BLOG.md`; this file is internal reference material only.

- [ ] **Step 1: Write the reference document**

Read ONLY the "Task 1" section of `docs/plans/2026-08-04-oktoberfest-2026-and-bulletin-tracking-plan.md` for the three tent tables. Do not read the rest of the plan.

The document must contain, in this order:

1. **Festival facts:** 191st Oktoberfest, 19 September to 4 October 2026, 16 days, Theresienwiese (48.1314, 11.5498). Maß range EUR 14.80 to 15.90. Festival base price EUR 15.80. The Oide Wiesn runs in 2026 (the Zentral-Landwirtschaftsfest that displaces it is not due again until 2028).
2. **Full tent table:** all 40 tents with name, category, Maß price, latitude, longitude, copied from the Task 1 tables. Add a column marking whether the price was published for 2026 or inherited from the festival default. The 13 inherited ones are: Bodo's Cafézelt, Café Theres', Feisingers, Glöckle-Wirt, Goldener Hahn, Heimer, Heinz, Hühnerbraterei Poschner, Münchner Knödelei, Rischart's Café Kaiserschmarrn, Schiebl's Kaffeehaferl, Wiesn Guglhupf, Wildstuben.
3. **What changed for 2026:** Bartls Flößerstadl (398 seats) is new and replaces Münchner Stubn on the same plot. Bodo's Cafézelt was rebuilt in wood, replacing its aluminium structure, capacity unchanged at 587. The Paulaner-Festzelt has new operators, Christine and Lorenz Stiftl, who previously ran the Schützenlisl. Michael Bietsch moved from the Historische Kegelbahn into the Volkssängerzelt Schützenlisl, which now serves Hacker-Pschorr from wooden casks. Sabine Erhard took over the Historische Kegelbahn. The Museumszelt gained a photography exhibition on Oktoberfest postcards. `Herzkasperlzelt` and `Zur Schönheitskönigin` are not in the 2026 lineup.
4. **Notable price facts, useful for a post:** the EUR 15 barrier was broken in almost every large tent for 2026. Joint most expensive beer at EUR 15.90: Armbrustschützen, Bräurosl, Löwenbräu. Cheapest large tent: Augustiner-Festhalle at EUR 14.90. Cheapest on the grounds: Museumszelt at EUR 14.80. The Weinzelt's Weißbier Maß is EUR 17.80, the dearest pour anywhere on the Wiesn.
5. **Data caveats,** stated plainly so a future post does not overclaim: Bartls Flößerstadl's EUR 15.70 comes from a single source, and that source also miscategorised it as a large tent. 13 small-tent prices were never published per-tent and are the festival default, not researched values. Münchner Weißbiergarten and Wiesn Guglhupf have no coordinate source and are recorded as NULL. Museumszelt is EUR 14.80 per the 2026 source; a separate table gave EUR 14.60 but was labelled 2025.
6. **A short note on the coordinate correction,** which is itself a good blog anecdote: the coordinates shipped before this migration were placeholders, described as "approximate" in `supabase/migrations/20260126000000_postgis_tent_coordinates.sql`. Sorted by position they fell on an evenly spaced diagonal line across Theresienwiese. Measured against OSM, Marstall-Festzelt was off by roughly 900 m, the Museumszelt by roughly 650 m, and the Hofbräu-Festzelt by roughly 235 m. The giveaway that the new data is right: OSM places the Oide Wiesn tents south of the main tents, matching the real grounds, whereas the placeholders put them to the east.
7. **Sources,** as a list of links:
   - <https://www.oktoberfest.de/en>
   - <https://www.munichtourism.org/oktoberfest-dates-schedule/>
   - <https://wiesnkini.de/zelte/bierpreis/>
   - <https://www.in-muenchen.de/stadtleben/oktoberfest-wiesn-preise.html>
   - <https://www.oktoberfest.de/en/beer-tents/small-tents>
   - <https://www.oktoberfest.de/en/tents/tents-oide-wiesn/festival-tents-oide-wiesn-event-glance>
   - <https://www.muenchen.de/veranstaltungen/oktoberfest/aktuell/oktoberfest-2026-das-ist-neu-auf-der-wiesn>
   - <https://www.falstaff.com/de/news/neuer-wiesn-wirt-floesserstadl-ersetzt-muenchner-stubn-auf-dem-oktoberfest>
   - <https://www.muenchen.de/veranstaltungen/wiesn-kleine-zelte/bartls-floesserstadl>
   - OpenStreetMap via the Overpass API, ODbL licensed, snapshot 2026-08-04

Attribute the coordinates to OpenStreetMap contributors and name the ODbL licence explicitly. That attribution is a licence requirement if any of this reaches a published post.

- [ ] **Step 2: Commit**

```bash
git add docs/festivals/oktoberfest-2026-reference.md
git commit -m "docs: Oktoberfest 2026 tent data and sources for reference"
```

---

## Reading the results

- Delivery, bounces and complaints: the Resend broadcast detail pages for the two broadcast IDs. NOT clicks or opens; tracking is off, so Resend reports delivery only.
- Web sessions and downstream behaviour: GA4, Acquisition, Traffic acquisition, filtered to `email / bulletin`.
- Android installs: Play Console, Acquisition reports, filtered by `utm_campaign = aug2026-whatsnew`.
- iOS installs: App Store Connect, App Analytics, Campaigns, campaign `aug2026-whatsnew`. Only populated if Task 6 produced a token.

**Known blind spot:** there is no per-link click count and no open rate. If the web link shows GA4
sessions but the stores show no installs, that is indistinguishable from nobody tapping the store
buttons at all. Accepted as the cost of staying on the free plan.
