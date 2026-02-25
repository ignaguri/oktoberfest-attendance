# Integration Branch: `feat/integration-new-features`

This branch integrates **four independent features** developed in parallel worktrees, plus significant integration/refactoring work on top. PR #177 currently only describes one of these (offline-first migration). This document covers all four.

---

## Feature 1: Offline Attendance & Festival Cache Fix

**Branch:** `fix/offline-attendance-and-festival-cache`
**Core commit:** `91c0618`

### Problem
Two critical offline bugs in the mobile app:
1. `useSaveAttendance` called the API directly and hung when offline.
2. `FestivalContext` only loaded from the API, failing on cold start without connectivity.

### Solution
- **Offline attendance wrapper** (`apps/mobile/hooks/useOfflineAttendance.ts`): writes to the SQLite sync queue when offline, falls back to the API when online.
- **Festival caching** (`apps/mobile/lib/festival-storage.ts`, `apps/web/lib/festival-storage.ts`): `getCachedFestival`/`setCachedFestival` added to `FestivalStorage` interface so the `FestivalContext` can bootstrap from cache when the API is unreachable.

### Files touched
| Layer | Files |
|-------|-------|
| Mobile hooks | `apps/mobile/hooks/useOfflineAttendance.ts` (new), `apps/mobile/hooks/useSaveAttendance.ts` |
| Festival storage | `apps/mobile/lib/festival-storage.ts`, `apps/web/lib/festival-storage.ts` |
| Shared context | `packages/shared/src/contexts/festival/FestivalContext.tsx`, `packages/shared/src/contexts/festival/types.ts` |

---

## Feature 2: Photo Reactions & Comments

**Branch:** `feat/photo-reactions-comments`
**Core commit:** `cc1d6e8`

### What it adds
Group-scoped emoji reactions (🍺 ❤️ 😂 🔥 👏 🤮) and text comments on gallery photos. The same photo in different groups has completely separate interactions.

### Database (in `20260223100000_add_social_features.sql`)
- **`photo_reactions`** — unique per (photo, group, user, emoji), cascade-deletes with photo/group/user.
- **`photo_comments`** — 1–500 char content, timestamps, cascade-deletes.
- Indexes on `(photo_id, group_id)` and `created_at`.
- RLS: group members read/write, owner update/delete, super-admin override.

### API (`packages/api/src/routes/photo-social.route.ts`) — 7 endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/photos/{photoId}/reactions` | Aggregated reactions with user lists |
| POST | `/photos/{photoId}/reactions` | Add emoji reaction |
| DELETE | `/photos/{photoId}/reactions` | Remove reaction |
| GET | `/photos/{photoId}/comments` | Comment thread |
| POST | `/photos/{photoId}/comments` | Add comment |
| PATCH | `/photos/{photoId}/comments/{commentId}` | Edit comment |
| DELETE | `/photos/{photoId}/comments/{commentId}` | Delete comment |

### Shared hooks (`packages/shared/src/hooks/usePhotoSocial.ts`)
`usePhotoReactions`, `useAddReaction`, `useRemoveReaction`, `usePhotoComments`, `useAddComment`, `useUpdateComment`, `useDeleteComment`

### Mobile UI
- `apps/mobile/components/gallery/photo-detail-modal.tsx` — image carousel + reaction buttons + comment thread with edit/delete.

### i18n
`photos.reactions.*`, `photos.comments.*` — en, de, es.

---

## Feature 3: Tent Crowd Reporting (Waze-style)

**Branch:** `feat/tent-crowd-reporting`
**Core commit:** `3938b86`

### What it adds
Real-time crowd level and wait-time reporting for festival tents. Users report capacity (empty / moderate / crowded / full) and optional wait time (0–180 min). A rolling 30-minute aggregate shows the current status per tent.

### Database (in `20260223100000_add_social_features.sql`)
- **`crowd_level`** enum — `empty | moderate | crowded | full`.
- **`tent_crowd_reports`** — report with `crowd_level`, `wait_time_minutes` (0–180), indexed on `(tent_id, festival_id)`.
- **`tent_crowd_status`** view — `MODE()` for level, `AVG()` for wait time, `COUNT()` reports, scoped to last 30 min and current festival tents.
- RLS: all authenticated read, users post/delete own, super-admin override.
- Server-side rate limit: 1 report per tent per user per 5 minutes.

### API (`packages/api/src/routes/crowd-report.route.ts`) — 3 endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/tents/crowd-status` | Aggregated status for all tents |
| GET | `/tents/{tentId}/crowd-reports` | Recent individual reports |
| POST | `/tents/{tentId}/crowd-report` | Submit report (rate-limited) |

### Shared hooks (`packages/shared/src/hooks/useCrowdReports.ts`)
`useTentCrowdStatus`, `useTentCrowdReports`, `useSubmitCrowdReport`

### Mobile UI (`apps/mobile/components/crowd/`)
- `crowd-level-badge.tsx` — colored dot + label (green → red).
- `crowd-report-sheet.tsx` — level picker + wait-time selector.
- `crowd-status-summary.tsx` — card for home screen.
- `crowd-report-fab.tsx` — FAB positioned above beer FAB.
- `crowd-report-prompt.tsx` — tent selector for multi-tent reporters.

### Colors (`apps/mobile/lib/constants/colors.ts`)
`CrowdColors.empty` (green), `.moderate` (yellow), `.crowded` (orange), `.full` (red).

### i18n
`crowdReport.*` — en, de, es (27 keys).

---

## Feature 4: Group Message Board

**Branch:** `feat/group-message-board`
**Core commit:** `c7688bb`

### What it adds
Group-scoped message board with two message types: **message** (standard) and **alert** (featured). Alerts surface on a cross-group home feed; all messages appear in the per-group board. Supports pinned messages, full CRUD, and cursor-based pagination.

### Database (in `20260223100000_add_social_features.sql`)
- **`group_message_type`** enum — `message | alert`.
- **`group_messages`** — content (1–1000 chars), `message_type`, `pinned` boolean, timestamps.
- Indexes on `(group_id, created_at DESC)` and `(group_id, pinned)`.
- RLS: group members read/write, owner update/delete (WITH CHECK), super-admin override.

### API (`packages/api/src/routes/group-message.route.ts`) — 5 endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/groups/{groupId}/messages` | List messages (cursor pagination, pinned first) |
| GET | `/messages/feed` | Cross-group feed (alerts + recent) |
| POST | `/groups/{groupId}/messages` | Create message or alert |
| PUT | `/groups/{groupId}/messages/{messageId}` | Update message |
| DELETE | `/groups/{groupId}/messages/{messageId}` | Delete message |

### Shared hooks (`packages/shared/src/hooks/useGroupMessages.ts`)
`useGroupMessages`, `useMessageFeed`, `usePostMessage`, `useUpdateMessage`, `useDeleteMessage`

### Mobile UI
- `apps/mobile/app/groups/[id]/messages.tsx` — full message board screen with pagination, pinned messages, compose FAB, delete confirmation.
- `apps/mobile/components/messages/compose-message.tsx` — bottom sheet with message/alert toggle, character counter.
- `apps/mobile/components/messages/message-item.tsx` — card with avatar, timestamp, type badge, owner actions.
- `apps/mobile/components/messages/message-feed.tsx` — home-screen widget showing top 5 cross-group messages.

### i18n
`groups.messages.*` — en, de, es (35+ keys).

---

## Integration & Refactoring Work (on top of the four features)

These commits were made after merging the four branches to integrate, fix issues, and improve architecture:

| Commit | Description |
|--------|-------------|
| `5b6c837` | Add FK hints from `photo_reactions`/`photo_comments` → `profiles` for PostgREST joins; regenerate API client |
| `c82dba7` | Gate crowd reporting to visited tents only; add home FAB entry point |
| `50a44cb` | Migrate core screens (Home, Attendance, Profile, Groups) to offline-first adapted hooks |
| `a56e712` | Fix stale data on pull-to-refresh; address PR review comments |
| `234207d` | Fix hardcoded strings → i18n keys; fix German umlauts / Spanish accents |
| `902d3d2` | Address remaining PR review comments (type safety, API responses) |
| `d2daf8e` | **Squash 4 separate migrations into single `20260223100000_add_social_features.sql`**; add `WITH CHECK` to group_messages UPDATE; fix `tent_crowd_status` view festival scoping; add super-admin policies; centralize `CrowdColors` |
| `8d1602b` | **Drizzle ORM adoption**: replace 100+ raw SQL strings with typed schema in `apps/mobile/lib/database/schema/` (12 files) and query helpers in `queries.ts` |
| `5883963` | **Sync manager decomposition**: break 1,285-line monolith into 8 focused modules under `apps/mobile/lib/database/sync/`; fix offline consumption push (camelCase → snake_case payload) |

---

## Summary Table

| Feature | DB Tables | API Endpoints | Shared Hooks | Mobile Screens/Components | i18n Keys |
|---------|-----------|---------------|--------------|---------------------------|-----------|
| Offline Attendance Fix | — (SQLite) | — | 1 | 1 hook + context changes | — |
| Photo Reactions/Comments | `photo_reactions`, `photo_comments` | 7 | 7 | `photo-detail-modal` | ~27 |
| Crowd Reporting | `tent_crowd_reports`, `tent_crowd_status` view | 3 | 3 | 5 components | ~27 |
| Group Message Board | `group_messages` | 5 | 5 | 1 screen + 3 components + feed widget | ~35 |
| **Totals** | **4 tables + 1 view** | **15** | **16** | **~11** | **~89** |
