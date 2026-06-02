# Novu Drift Resolution — Design Spec

**Date:** 2026-06-02
**Status:** Draft (awaiting review)
**Owner:** Ignacio Guri

## Background

ProstCounter uses Novu (Cloud, US region) for in-app + push notifications across the
Next.js web app and the Expo mobile app. The integration was originally built **code-first**
with `@novu/framework`: workflows defined in `apps/web/novu/workflows/*.ts`, served from a
bridge endpoint (`apps/web/app/api/novu/route.ts`), and pushed to Novu via `scripts/novu-sync.ts`.

At some point the workflows were edited/recreated in the **new Novu dashboard**. All 9 active
workflows now report `origin: "novu-cloud"` (verified via the Novu MCP against the **Development**
environment, 2026-06-02). This means the dashboard is now the de-facto source of truth and **the
bridge function is never executed** — Novu renders from the content stored in the dashboard, not
from our code.

The result is a **code ↔ cloud drift** that has caused real defects.

### Confirmed defects caused by the drift

1. **`friend-request` renders a blank sender name.** The trigger sends
   `payload: { requesterName, requesterAvatar, requesterId }`
   (`packages/api/src/services/notification.service.ts` `notifyFriendRequest`), but both the code
   workflow and the cloud template read `{{payload.senderName}}` / `{{payload.senderAvatar}}`.
   Mismatched keys → "_(blank)_ sent you a friend request".

2. **`daily-reminder` rotation is dead.** The cron (`apps/web/app/api/cron/scheduler/daily-reminders.ts`)
   computes `dayOfYear` and the code workflow rotates through `MOTIVATIONAL_MESSAGES`. But the
   cloud froze the push step to static content (`"Time to check in! 🍺"` — index 0), and since the
   workflow is cloud-origin the rotation code never runs. Every user gets the same message daily.

3. **Pervasive payload-key mismatches.** Auditing all triggers against the code/cloud templates,
   nearly every workflow has at least one mismatched or missing payload key (see Reconciliation
   Table below).

4. **`location-sharing` is not registered in the bridge** `serve()` list (`route.ts` imports 8
   workflows, omitting it) yet runs fine in prod — direct proof the bridge is already bypassed.

### Related finding — native push (the "we added Expo Push" episode)

The mobile app migrated **FCM → Expo Push** (mobile code: `getStoredFCMToken() // Legacy name,
but stores Expo push token now`; `storeFCMToken as saveExpoPushToken`). Live Novu push
integrations (Development env):

- `fcm` / `firebase-cloud-messaging-native` — created 2026-01-19, `primary: false`
- `expo` / `expo-push` — created 2026-04-10, `primary: false`

The Expo integration was added one day after the workflows were frozen to cloud-origin
(2026-04-09). Diagnosis splits in two:

- **Push not *arriving* on native** → FCM provider issue → motivated the switch to Expo. Template
  drift does **not** stop delivery, so this was a provider/credentials problem, not the drift.
- **Push arriving but *broken* (blank text)** → that **is** the drift (push steps render
  `{{payload.X}}` keys the triggers don't send).

**Config smell:** both `fcm` and `expo` push integrations are active and **neither is `primary`**.
With the app now sending Expo tokens, the FCM integration is likely dead weight and the missing
primary is a delivery risk.

## Goals

1. Make the **Novu Cloud dashboard the single source of truth**; remove the dead code-first/bridge
   machinery so the drift cannot recur.
2. Fix the live rendering bugs by reconciling every trigger's payload with its dashboard template.
3. Delete `daily-reminder` end-to-end (no longer needed — product decision).
4. Resolve the push-integration hygiene issue (primary provider, dead FCM path, env identifiers).

## Non-Goals

- Consolidating the two notification services into one (see "Two services" note). Out of scope.
- Changing the `@novu/api` `ResponseValidationError` workaround in `packages/shared/src/utils/novu.ts`.
- Re-architecting cron scheduling or notification preferences.

## Key Decisions

- **Source of truth: Cloud / dashboard.** (Option A, chosen 2026-06-02.)
- **FCM push integration: keep active** as a fallback (Expo set primary). (Chosen 2026-06-02.)
- **Reconciliation direction: prefer editing dashboard templates** to match the keys triggers
  already send. Only edit trigger code where a template needs a field that isn't sent at all, or
  where the trigger sends a non-display-ready value (e.g. ISO timestamp) that the template can't
  format.

## Two notification services (context, not changing)

Both are canonical, split by domain:

- `packages/api/src/services/notification.service.ts` (Hono API) — real-time events:
  friend-request (`friend.route.ts`), tent-check-in (`attendance.route.ts`), preferences/token
  registration (`notification.route.ts`).
- `apps/web/lib/services/notifications.ts` (web) — scheduled/cron + web routes: reservations,
  achievements, group-achievement, daily-reminder (to be deleted), location-sharing, identify.

There is duplication (both define several `notify*` methods). Consolidation is explicitly out of
scope; this spec only reconciles the payload keys each live trigger actually sends.

## Environment access (dev + prod both reachable via MCP)

Two Novu MCP servers are configured: `novu` (Development env key) and `novu-prod` (Production env
key). Both environments can be inspected and edited directly via MCP.

**Prod state verified (2026-06-02):**
- Same **9 workflows** as dev, all `origin: "novu-cloud"`, all ACTIVE → the drift is identical in
  prod. `friend-request` last triggered **2026-05-05** (the blank-name bug is live for real users).
- Prod has **no demo/onboarding workflows** — the 6 samples exist only in dev. Workflow cleanup
  (work area E) is therefore **dev-only**.
- Prod push integrations: `expo` (`expo-push`, `primary: false`) and `fcm`
  (`firebase-cloud-messaging-native-prod`, `primary: false`). Both active, neither primary — same
  smell as dev. The prod FCM identifier matches `.env.example`; dev uses the un-suffixed
  `firebase-cloud-messaging-native` (env-specific, not a bug).

**Approach:** apply each template fix in **dev** first, trigger-verify, then apply the same fix in
**prod** via `novu-prod` MCP (or promote via the dashboard) and re-verify. No manual-only step is
required since prod is directly reachable.

## Reconciliation Table (target = keys the trigger sends)

> Exact current cloud template variables will be confirmed per-workflow during implementation by
> fetching each workflow via the MCP. The **target** column below is the canonical payload (what
> the live trigger sends); dashboard templates will be edited to consume exactly these.

| Workflow ID | Trigger source | Target payload keys (canonical) | Known template mismatch to fix |
|---|---|---|---|
| `friend-request` | API `notifyFriendRequest` | `requesterName`, `requesterAvatar`, `requesterId` | template uses `senderName`/`senderAvatar` → rename to `requester*` |
| `tent-check-in-notification` | API `notifyTentCheckin` | `userName`, `tentName`, `groupName`, `userAvatar` | template references `beersCount`/`checkInTime` (not sent) → remove |
| `reservation-reminder-notification` | web `notifyReservationReminder` | `reservationId`, `tentName`, `startAtISO`, `festivalName?` | template uses `partySize`/`reservationTime`/`userName` (not sent) → rework to sent keys; format `startAtISO` via LiquidJS or send a formatted field |
| `reservation-check-in-prompt` | web `notifyReservationPrompt` | `reservationId`, `tentName`, `deepLinkUrl` | template uses `reservationTime`/`userName` (not sent) → rework; wire `deepLinkUrl` into redirect |
| `achievement-unlocked` | web `notifyAchievementUnlocked` | `achievementName`, `description?`, `rarity`, `achievementId` | template uses `achievementDescription`/`achievementIcon`/`userName` → map to `description`; derive icon from `rarity` or drop |
| `group-achievement-unlocked` | web `notifyGroupAchievement` | `achieverName`, `achievementName`, `rarity`, `groupName?` | template uses `contributorName`/`achievementDescription`/`achievementIcon` → map to `achieverName`; drop unsent |
| `group-join-notification` | web/API `notifyGroupJoin` | `joinerName`, `groupName`, `joinerAvatar`, `groupId` | likely matches — verify cloud template |
| `location-sharing-notification` | web/API `notifyLocationSharing` | `sharerName`, `groupName`, `sharerAvatar`, `groupId`, `action` | likely matches — verify cloud template |

Where a template needs a display value the trigger doesn't provide cleanly (formatted time, rarity
icon), the preferred fix is to **send a display-ready field in the payload** (small trigger edit)
rather than rely on fragile template logic — decided per workflow during implementation.

## Work Breakdown

### A. Delete the bridge / code-first layer
- Remove `apps/web/novu/` (all 9 workflow files, `index.ts`, README, tsconfig).
- Remove `apps/web/app/api/novu/route.ts` (bridge `serve`). Keep `apps/web/app/api/novu/identify/route.ts`.
- Remove `scripts/novu-sync.ts` and the `novu:sync` script in `package.json`.
- Remove `@novu/framework` from `apps/web/package.json`; drop any now-dead imports
  (e.g. `apps/web/lib/services/notifications.ts` imports `DAILY_REMINDER_WORKFLOW_ID` and other
  IDs from `@/novu/workflows/*` — switch these to `NOTIFICATION_WORKFLOWS` constants from
  `@prostcounter/shared/constants`).

### B. Delete `daily-reminder` end-to-end
- Code: workflow file; `notifyDailyReminder()` in web service; cron file
  `app/api/cron/scheduler/daily-reminders.ts` + its wiring in `scheduler/route.ts`; the
  `DAILY_REMINDER` entries in `packages/shared/src/constants/notifications.ts`
  (`NOTIFICATION_WORKFLOWS` and `NOTIFICATION_PUSH_TYPES` if unused elsewhere); any related tests.
- Cloud: deactivate then delete the `daily-reminder` workflow in **both** dev (`novu`) and prod
  (`novu-prod`) via MCP. Deactivate first; only delete after the code removal is deployed.

### C. Reconcile payload contracts (per Reconciliation Table)
- For each remaining workflow: fetch cloud template, edit dashboard template vars to match the
  canonical payload keys, add small trigger edits only where required for display-ready values.
- Apply in dev, verify, promote to prod.

### D. Push integration hygiene
- Set the **Expo Push** integration as the **primary** push integration in **both** dev and prod
  (`set_primary_integration` via the respective MCP), since the app now sends Expo tokens.
- **Keep the FCM integration active** (decision 2026-06-02) as a fallback for older installed
  clients that may still send FCM tokens. Expo becomes primary; FCM stays active. Retain the
  `registerFCMToken` path and `NOVU_FCM_INTEGRATION_ID` env. (Optional future task: remove FCM after
  a deprecation window once analytics confirm no FCM tokens are being registered.)
- Env identifiers are environment-specific and already correct: prod `NOVU_FCM_INTEGRATION_ID=firebase-cloud-messaging-native-prod`
  (matches prod integration), dev uses `firebase-cloud-messaging-native`. No env change needed.

### E. General cleanup
- Clear/fix the stale Development env bridge URL
  (`deploy-preview-8--onboarding-sandbox.netlify.app/api/novu`) via MCP, or leave inert if removing
  the bridge concept makes it harmless.
- Delete the 6 inactive onboarding sample workflows (**dev only** — prod has none):
  `demo-comment-on-task`, `demo-verify-otp`, `demo-apartment-review`, `demo-recent-login`,
  `demo-password-reset`, `a-new-member-joining-the-team`.

## Verification

- For each reconciled workflow, trigger it against a dev subscriber via the Novu MCP and confirm
  rendered subject/body/data have no blank/unresolved variables (in-app **and** push steps).
- `pnpm lint` and `pnpm type-check` clean across the monorepo.
- Confirm the cron scheduler builds and runs after `daily-reminder` removal (check
  `scheduler/route.ts`, `achievements.test.ts`, `reservations.test.ts`).
- Manual prod verification of promoted workflows + push delivery on a real device (Expo token).

## Risks

- **Low overall.** No workflow ID changes → triggers keep working. Code deletions are inert (bridge
  already bypassed).
- **Dev→prod promotion** is the main operational risk: template fixes must be promoted, and prod
  state verified separately since the MCP is dev-scoped.
- **Push integration changes** (primary/remove FCM) affect live delivery — validate on a device
  before/after.

## Rollback

- Code changes revert via git.
- Dashboard template edits: Novu keeps change history; revert via the dashboard. Avoid deleting the
  `daily-reminder` cloud workflow until code removal is deployed and verified (deactivate first).
