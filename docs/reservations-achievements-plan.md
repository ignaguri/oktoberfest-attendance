## Reservations, Calendars, and Achievement Notifications - Implementation Plan

### Overview
- **Goal**: Add reservations with reminders and check-in prompts; unified personal/group calendars; achievement notifications.
- **Decisions**:
  - Tent is required for reservations.
  - No auto check-in; send a prompt: “Are you there yet?” with CTA to check-in.
  - Reminder default: 1 day before.
  - Reservation visibility: default ON; per-reservation override.
  - Group notifications for achievements only for rare/epic; notify only members of the same festival groups of the achiever.
  - Pattern: Vercel Cron for scheduling.
  - Preferences simplified to: `reminders_enabled`, `group_notifications_enabled`, `achievement_notifications_enabled`.

### Pre-steps (Foundational Work)

- **UI: Replace and enhance date pickers using shadcn calendar blocks** ✅
  - Adopt shadcn calendar components to unify UX and improve mobile interactions. Reference blocks: `calendar-32` (Date picker in a drawer), `calendar-31` (calendar with events), and variants for custom days/formatters from `calendar-01`..`calendar-04`.
  - Attendance table: replace existing date picker with the Drawer-based picker for better mobile flow. ✅
  - Calendars: build personal and group calendars using “calendar with events” + custom day renderers to show badges for attendances/reservations and event slots. Source: `https://ui.shadcn.com/blocks/calendar`. ✅ (personal + group scaffolds, URL-driven dialogs)
  - Implementation notes:
    - Wrap shadcn `Calendar` with adapters for festival timezone display.
    - Create shared decorators (badges, counts, tent icons) and event list beneath the calendar (responsive design).
    - Drive event data via RPCs defined in Phase 2.

- **Notifications: Migrate Novu workflows to code-first using Novu Framework** ✅ (initial)
  - Scaffold a `novu/` directory with code-defined workflows for existing flows (group join, tent check-in) and upcoming flows (`RESERVATION_REMINDER`, `RESERVATION_CHECKIN_PROMPT`, `ACHIEVEMENT_UNLOCKED`, `GROUP_ACHIEVEMENT_UNLOCKED`). ✅ (group join, tent check-in)
  - Add GitHub Actions CI/CD pipeline to validate and sync workflows to Novu (API key via repo secret). Ensure idempotent deployment and environment selection. ✅ (`.github/workflows/novu-sync.yml` + `pnpm novu:sync`)
  - Update `NotificationService` to reference workflow IDs defined in code; align payload contracts. ✅
  - Governance: PR review for workflow changes; version workflows as needed.

- **Tooling & Docs**
  - Use Context7 MCP for library/API references (Novu Framework, shadcn variations, Supabase RPC patterns).
  - Use Supabase MCP for validating RPC queries and schema impacts during development.

### Phase 1: Database Schema

#### 1.1 New table: `reservations` ✅
- Columns:
  - `id uuid pk`
  - `user_id uuid not null` -> `profiles(id)`
  - `festival_id uuid not null` -> `festivals(id)`
  - `tent_id uuid not null` -> `tents(id)`
  - `start_at timestamptz not null`
  - `end_at timestamptz null`
  - `status text not null default scheduled` (enum-like: scheduled|canceled|completed|failed)
  - `reminder_offset_minutes int not null default 1440` (1 day)
  - `reminder_sent_at timestamptz null`
  - `prompt_sent_at timestamptz null`
  - `processed_at timestamptz null`
  - `visible_to_groups boolean not null default true`
  - `auto_checkin boolean not null default false` (for future use; currently always false)
  - `note text null`
  - `created_at timestamptz default now()`
  - `updated_at timestamptz default now()`
- Indexes:
  - `idx_reservations_user_start_at (user_id, start_at)`
  - `idx_reservations_festival_start_at (festival_id, start_at)`
  - `idx_reservations_status_start_at (status, start_at)`
  - `idx_reservations_visible_to_groups (visible_to_groups)`
  - `idx_reservations_tent (tent_id)`
- RLS Policies:
  - Enable RLS.
  - Owner can SELECT/INSERT/UPDATE/DELETE.
  - Group visibility policy: users who share a group in the same `festival_id` with the owner can SELECT rows where `visible_to_groups = true`.

#### 1.2 Preferences: `user_notification_preferences`
- Add columns (and deprecate old toggles at UI-level):
  - `reminders_enabled boolean default true`
  - `group_notifications_enabled boolean default true`
  - `achievement_notifications_enabled boolean default true`
- Keep existing columns for backward-compat for now; UI writes/reads only the three new columns.
- Update default creation trigger to set new columns.

#### 1.3 Achievement events queue
- New table `achievement_events`:
  - `id uuid pk default gen_random_uuid()`
  - `user_id uuid not null` -> `profiles(id)`
  - `festival_id uuid not null` -> `festivals(id)`
  - `achievement_id uuid not null` -> `achievements(id)`
  - `rarity achievement_rarity_enum not null`
  - `created_at timestamptz default now()`
  - `user_notified_at timestamptz null`
  - `group_notified_at timestamptz null`
  - Indexes: `(user_notified_at NULLS FIRST)`, `(group_notified_at NULLS FIRST)`, `(festival_id, created_at)`.
- Trigger: AFTER INSERT on `user_achievements` inserts into `achievement_events` with rarity from `achievements`.
- RLS: owner can SELECT own events; inserts via trigger with SECURITY DEFINER; cron uses service role.

### Phase 2: Server Actions & RPCs

#### 2.1 Reservations actions (Next.js Server Actions) ✅ (create/update/cancel)
- `createReservation({ festivalId, tentId, startAt, endAt?, reminderOffsetMinutes?, visibleToGroups?, note? })`
  - Validates: tent exists, within festival dates/timezone [[memory:6869223]].
  - Inserts `reservations`.
- `updateReservation(id, partial)`
  - Allowed fields: `startAt`, `endAt`, `reminderOffsetMinutes`, `visibleToGroups`, `note`, `tentId`.
- `cancelReservation(id)`
  - Sets `status = canceled`.
- `listReservationsByUser(festivalId)`
- `listGroupReservations(festivalId, groupId?)` (all my groups by default)

#### 2.2 RPCs (Supabase SQL)
- `rpc_get_personal_calendar(p_user_id uuid, p_festival_id uuid)` ⏸️ (deferred)
  - Returns unified feed by day: attendances (with beer_count, tents) + upcoming reservations.
- `rpc_get_group_calendar(p_user_id uuid, p_festival_id uuid, p_group_id uuid null)` ⏸️ (deferred)
  - Applies visibility rules; aggregates by member.
- `rpc_due_reservation_reminders(now timestamptz)` ✅
  - Returns reservations where `status=scheduled`, `reminder_sent_at is null`, `start_at - (reminder_offset_minutes * interval 1 minute) <= now`, and owner has `reminders_enabled`.
- `rpc_due_reservation_prompts(now timestamptz)` ✅
  - Returns reservations where `status=scheduled`, `prompt_sent_at is null`, `start_at <= now`, and owner has `reminders_enabled`.

### Phase 3: Notifications & Workflows ✅ (core workflows + service methods)

#### 3.1 NotificationService additions ✅
- Workflows (Novu): ✅ code-first in `novu/workflows/*`
  - `RESERVATION_REMINDER`
  - `RESERVATION_CHECKIN_PROMPT` (deep links into app with `?reservation=...`)
  - `ACHIEVEMENT_UNLOCKED` (to user)
  - `GROUP_ACHIEVEMENT_UNLOCKED` (to group members)
- Methods: ✅ implemented in `lib/services/notifications.ts`
  - `notifyReservationReminder(userId, payload)`
  - `notifyReservationPrompt(userId, payload)`
  - `notifyAchievementUnlocked(userId, payload)`
  - `notifyGroupAchievement(recipientIds, payload)` (only rare/epic)
- Preferences application: ✅ respected in service methods
  - `reminders_enabled` for reservation notifications
  - `achievement_notifications_enabled` for user notices
  - `group_notifications_enabled` and rarity filter for group notices

### Phase 4: Cron Processor (Vercel Cron) ✅

- Route: `app/api/cron/scheduler/route.ts` (delegates to `./reservations.ts` and `./achievements.ts`)
- Protection: require `X-CRON-SECRET` header; compare to env.
- Steps (every 5 minutes):
  1) Fetch due reminders via `rpc_due_reservation_reminders(now())`, send `RESERVATION_REMINDER`, set `reminder_sent_at = now()`.
  2) Fetch due prompts via `rpc_due_reservation_prompts(now())`, send `RESERVATION_CHECKIN_PROMPT`, set `prompt_sent_at = now()`.
  3) Process `achievement_events`:
     - User notifications: where `user_notified_at is null`; send `ACHIEVEMENT_UNLOCKED` when `achievement_notifications_enabled`; set timestamp.
     - Group notifications: where `group_notified_at is null AND rarity in (rare, epic)`; determine recipient group members for same `festival_id` (exclude achiever), and only if they share a group with the achiever; send `GROUP_ACHIEVEMENT_UNLOCKED` if recipients have `group_notifications_enabled`; set timestamp.
- Idempotency: update timestamps inside a transaction; use `FOR UPDATE SKIP LOCKED` in backing SQL or limit batches.
- Error handling: log to Sentry; mark reservation `status=failed` only on unrecoverable errors.

Deployment notes:
- Add `vercel.json` crons: `{"path":"/api/cron/scheduler","schedule":"*/5 * * * *"}`
- Set `CRON_SECRET` in Vercel project env; use it in the scheduler request header `x-cron-secret`.

### Phase 5: UI

#### 5.1 Personal Calendar ✅ (scaffold + dialogs + events)
- Location: `app/(private)/attendance/calendar/page.tsx` (or integrate into existing `attendance` with tabs).
- Features:
  - Calendar view: past attendances (beer count, tents) and future reservations.
  - Date click: if no entry, offer “Add reservation” or “Add attendance”.
  - If existing: “Edit reservation” or “Edit attendance”.
  - Creation/edit dialog: select tent, time, reminder offset, visibility, note.
  - URL state via `nuqs`: `?date=YYYY-MM-DD&reservationId=...&mode=edit|new`.
  - Check-in prompt deep-link opens dialog with action to log attendance and tent visit.

#### 5.2 Group Calendar ✅ (scaffold + events)
- Location: `app/(private)/groups/[id]/calendar/page.tsx`.
- Features:
  - Shows members’ past attendances and future reservations (only `visible_to_groups=true`).
  - Filters by member; per-day grouping.

#### 5.3 Notification Settings ✅
- Update `components/NotificationSettings.tsx` and `contexts/NotificationContext.tsx` to expose three toggles: `reminders_enabled`, `achievement_notifications_enabled`, `group_notifications_enabled`.
- Remove UI references to legacy per-type toggles; keep backward compatibility server-side.

### Phase 6: Check-in Prompt Flow ✅
- Push notification at `start_at` with CTA deep-link to `/attendance?reservationId=...&prompt=checkin`. ✅
- In app load, detect `prompt=checkin` and show responsive dialog "Are you there yet?" ✅
- CTA performs server action: create `attendances(beer_count=0)` for that day (festival-local date), insert `tent_visits(start_at)` if not present, set reservation `status=completed` and `processed_at`. ✅
- If user already has attendance that day, skip creation and mark reservation `completed`. ✅

### Phase 7: Migration & Commits Strategy
- Create new migrations using `pnpm sup:mig:new` for:
  1) `reservations` table + RLS/policies + indexes.
  2) Extend `user_notification_preferences` with 3 new columns + defaults in trigger.
  3) `achievement_events` table + trigger on `user_achievements`.
  4) RPCs for calendars and due items.
- After DB changes: `pnpm sup:db:push`, `pnpm sup:db:types`.
- Implement NotificationService changes and Novu workflows.
- Add cron route and Vercel Cron configuration.
- UI: personal calendar, group calendar, dialogs, settings updates.
- Group meaningful commits per phase (schema, service, cron, UI).

### API Contracts (Brief)
- `POST /api/reservations` create
- `PATCH /api/reservations/:id` update
- `DELETE /api/reservations/:id` cancel
- Server Actions equivalents for RSC.

### Risks & Mitigations
- Timezone mishandling: use date-fns-tz; store UTC; convert using festival timezone [[memory:6869223]].
- Duplicates on check-in: enforce unique attendance per (user, festival, date); pre-check in action.
- Notification noise: consolidated preferences; defaults sensible.
- RLS complexity for group visibility: start owner-only; add carefully tested SELECT policy.

### QA & Verification
- Environment setup ⏳
  - Ensure env vars are set locally and on Vercel: `CRON_SECRET`, `NOVU_API_KEY`, FCM keys.
  - Verify `vercel.json` has cron `POST /api/cron/scheduler` every 5 minutes and header `x-cron-secret` is enforced.
  - Confirm Novu environment (test vs prod) and subscriber identification flows.

- Seed test data ⏳
  - Create users, profiles, groups, tents, a festival, and link memberships.
  - Seed reservations (scheduled, various offsets), including one at now+X and one past due; seed achievements with different rarities.
  - Include an "early check-in" user scenario (attendance before reservation time).

- Calendars UI ✅
  - Personal calendar: events render for attendances/reservations; date click opens URL-driven dialog; timezone display matches festival.
  - Group calendar: shows members’ events respecting `visible_to_groups` and RLS.
  - Verify cache invalidation and tags when creating/updating/canceling reservations or attendances.

- Preferences toggles ✅
  - Toggle `reminders_enabled`, `achievement_notifications_enabled`, `group_notifications_enabled` and confirm behavior in notifications.
  - Validate push permission states in `NotificationContext` (default/denied/granted) and UI copy.

- Reservation reminder flow ⏳
  - Make a reservation due for reminder (adjust `start_at`/`reminder_offset_minutes`).
  - Call cron: `curl -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/scheduler`.
  - Verify Novu in-app/push delivery and DB `reminder_sent_at` set; confirm idempotency on repeated runs.

- Reservation check-in prompt ⏳
  - At `start_at`, run cron; confirm prompt is sent with deep-link.
  - Open deep-link; verify dialog, manual check-in, attendance creation (or skip if exists), reservation `status=completed` and `processed_at` set.

- Early check-in behavior ⏳
  - With an attendance created earlier the same day, run cron at reservation time; ensure no prompt is sent and reservation is marked completed.

- Achievements notifications ⏳
  - Unlock achievements of various rarities; verify user notification always (if enabled) and group notifications only for rare/epic.
  - Ensure recipients are only members sharing a group in the same festival; check `achievement_events` timestamps.

- Visibility & RLS ⏳
  - Validate group calendar visibility: non-members cannot read; members see only `visible_to_groups=true` reservations.

- Observability ⏳
  - Check Sentry logs for cron runs and error paths; ensure failures don’t spam and include context.

- Push cross-browser ⏳
  - Chrome and Safari (iOS/macOS): permission flows, denied/unsupported fallbacks to in-app.

- Performance & caching ⏳
  - Verify `unstable_cache` usage and revalidation tags keep calendars snappy; measure initial render and interactions.

### Success Criteria
- Users see unified personal calendar; can create/edit reservations and attendances.
- Reminders and check-in prompts fire at expected times.
- Achievers receive notifications; groups notified only for rare/epic within same festival groups.
- No duplicate attendances; errors monitored in Sentry.
