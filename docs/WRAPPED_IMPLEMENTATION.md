# Wrapped

A per-festival year-in-review: stats, tents, peak day, groups, achievements, personality and a share image. Web and mobile render the same data through their own slide components.

## Data flow

```
client (useWrapped)
  → GET /api/v1/wrapped/{festivalId}
    → get_wrapped_status(festival)        unlock time, is it unlocked, did the caller attend
    → get_wrapped_data_cached(user, fest) cache row or fresh get_wrapped_data
    → mapToWrappedData (snake → camel)    validated by WrappedDataSchema
  ← { status: "ready", wrapped } | { status: "locked", unlocksAt } | { status: "not_attended" }
```

Every case is a 200: the client needs `unlocksAt`, and the typed client drops error details. Serving `ready` records the view (`wrapped_data_cache.first_viewed_at` and `wrapped_views`) and runs achievement evaluation, which is what unlocks `wrapped_viewed`.

- API: `packages/api/src/routes/wrapped.route.ts`, `services/wrapped.service.ts`, `repositories/supabase/wrapped.repository.ts`, `repositories/supabase/wrapped-mapper.ts`
- Contract: `packages/shared/src/schemas/wrapped.schema.ts`
- Hooks: `packages/shared/src/hooks/useWrapped.ts` (`useWrapped`, `useWrappedFestivals`)
- Festival choice: `resolveWrappedFestivalId` in `packages/shared/src/wrapped/resolve-festival.ts`. The `festivalId` search param wins, then the newest unlocked festival, then the app's current festival (which shows its locked state).

## Unlock rule

`wrapped_unlocks_at(festival)` = 00:00 in `festivals.timezone` on `end_date + 1`. `festivals.status` is not consulted (nothing sets it). `get_wrapped_data_cached` enforces the rule itself and raises `WRAPPED_NOT_READY` when locked, so no client can compute or cache a Wrapped early.

Super admins see locked festivals as unlocked (preview). The preview is computed and never cached.

## Cache

`wrapped_data_cache` holds one row per user and festival, plus `data_version`. A row whose version differs from `wrapped_data_version()` is a miss and gets recomputed.

**Any migration that changes `get_wrapped_data` output must bump `wrapped_data_version()`.** Otherwise old shapes stay cached forever.

These triggers delete the affected rows:

| Table | When |
|---|---|
| `attendances` | any change |
| `consumptions` | insert, update (both old and new attendance), delete |
| `tent_visits` | any change |
| `beer_pictures` | insert, delete |
| `user_achievements` | any change |
| `profiles` | `username`, `full_name` or `avatar_url` actually changes (all of the user's rows) |
| `group_members` | join or leave a festival's group |

## Archive

`GET /api/v1/wrapped` (RPC `get_wrapped_festivals`) lists every unlocked festival the caller attended, newest first, with a `viewed` flag. Mobile shows it on Profile (`components/profile/wrapped-archive-section.tsx`), web under the profile form (`app/[lang]/(private)/profile/WrappedArchive.tsx`). Unviewed entries get a "New" pill.

## Admin regenerate

`POST /api/v1/wrapped/regenerate` calls `regenerate_wrapped_data_cache`. It upserts a fresh row for every attendee of every unlocked festival matching the optional user or festival filter, so it also seeds users who never opened Wrapped. Locked festivals are skipped.

## Why the RPC stays snake_case

Installed mobile binaries up to the release that shipped this call `get_wrapped_data_cached` directly and read snake_case keys. The RPC output is left as is; the API mapper is the only place that knows both shapes.

## Where the slides live

- Mobile: `apps/mobile/app/wrapped/index.tsx` → `components/wrapped/wrapped-pager.tsx` → `components/wrapped/slides/*`; states in `wrapped-state-screen.tsx`; share image in `share-image.tsx` + `hooks/useWrappedShare.ts`.
- Web: `apps/web/app/[lang]/(private)/wrapped/page.tsx` → `components/wrapped/core/WrappedContainer.tsx` → `components/wrapped/slides/*`; share page at `wrapped/share` (reads `localStorage["wrapped-share-data-v2"]`).
- Shared helpers: `packages/shared/src/wrapped/` (formatting, personality, config).

## Tests

- `packages/api/src/repositories/supabase/__tests__/wrapped-foundation.integration.test.ts`: unlock times (DST, non-Berlin), gating, cache version, archive, tent totals, previous festival, invalidation triggers, regenerate, repository against the real RPC.
- `wrapped-mapper.test.ts` with `fixtures/wrapped-data.{full,empty}.json`: the mapping and zero-drink attendee.
- `routes/__tests__/wrapped.route.test.ts`, `services/__tests__/wrapped.service.test.ts`.
