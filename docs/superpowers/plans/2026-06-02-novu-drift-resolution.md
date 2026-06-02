# Novu Drift Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Novu Cloud the single source of truth for notification workflows, delete the dead code-first/bridge layer, remove `daily-reminder` end-to-end, fix the live payload-rendering bugs by reconciling dashboard templates to trigger payloads, and resolve push-integration hygiene.

**Architecture:** Workflows already live in Novu Cloud (`origin: novu-cloud`) in both Development (`novu` MCP) and Production (`novu-prod` MCP). We delete the `@novu/framework` bridge/sync machinery in code, repoint the web service's workflow-ID constants to `@prostcounter/shared/constants`, and edit each dashboard template's `controlValues` to consume the exact `{{payload.X}}` keys the live triggers send. All cloud edits are applied in dev first, verified via `trigger_workflow`, then applied in prod.

**Tech Stack:** TypeScript, pnpm/Turborepo monorepo, Next.js (apps/web), Hono API (packages/api), Vitest, Novu Cloud + MCP (`mcp__novu__*` for dev, `mcp__novu-prod__*` for prod).

**Spec:** `docs/superpowers/specs/2026-06-02-novu-drift-resolution-design.md`

**Branch:** `chore/novu-drift-resolution` (already created).

**Conventions for every code commit:**
- Run `pnpm lint` and `pnpm type-check` before committing (CLAUDE.md requirement).
- Commit messages ≤ 72 char title.
- Do NOT push; PR is created at the end only when asked.

---

## Reconciliation reference (canonical payload = what the live trigger sends)

Dashboard templates will be edited so every `{{payload.X}}` reference matches these keys. Trigger call sites are listed so you can confirm before editing.

| Workflow ID | Trigger source(s) | Canonical payload keys | Template fix |
|---|---|---|---|
| `friend-request` | `packages/api` `notifyFriendRequest` (`friend.route.ts:191`) | `requesterName`, `requesterAvatar`, `requesterId` | in-app + push: `{{payload.senderName}}`→`{{payload.requesterName}}`, `{{payload.senderAvatar}}`→`{{payload.requesterAvatar}}` |
| `tent-check-in-notification` | `packages/api` `notifyTentCheckin` (`attendance.route.ts:348`) | `userName`, `tentName`, `groupName`, `userAvatar` | remove any `{{payload.beersCount}}` / `{{payload.checkInTime}}` refs; keep `userName`/`tentName`/`groupName`; avatar→`{{payload.userAvatar}}` |
| `group-join-notification` | `packages/api` `notifyGroupJoin` | `joinerName`, `groupName`, `joinerAvatar`, `groupId` | verify only — likely already matches |
| `location-sharing-notification` | `packages/api` `notifyLocationSharingStarted` (`location.route.ts:98`); web `notifyLocationSharing` (`location-sharing/preferences/route.ts:156`) | `sharerName`, `groupName`, `sharerAvatar`, `groupId`, `action` | verify; ensure no unsent keys referenced |
| `achievement-unlocked` | web `notifyAchievementUnlocked` (`achievements.ts:26`) | `achievementName`, `description`, `rarity`, `achievementId` | `{{payload.achievementDescription}}`→`{{payload.description}}`; drop `{{payload.achievementIcon}}`/`{{payload.userName}}`; redirect uses `/achievements` (static) |
| `group-achievement-unlocked` | web `notifyGroupAchievement` (`achievements.ts:89`) | `achieverName`, `achievementName`, `rarity`, `groupName` | `{{payload.contributorName}}`→`{{payload.achieverName}}`; drop `{{payload.achievementDescription}}`/`{{payload.achievementIcon}}` |
| `reservation-reminder-notification` | web `notifyReservationReminder` (`reservations.ts:26`) | `reservationId`, `tentName`, `startAtISO`, `festivalName?` | drop `{{payload.partySize}}`/`{{payload.reservationTime}}`/`{{payload.userName}}`; keep `tentName`; for time use `{{payload.startAtISO}}` (raw ISO) or omit time |
| `reservation-check-in-prompt` | web `notifyReservationPrompt` (`reservations.ts:57`) | `reservationId`, `tentName`, `deepLinkUrl` | drop `{{payload.reservationTime}}`/`{{payload.userName}}`; keep `tentName`; in-app redirect url → `{{payload.deepLinkUrl}}` |

> The exact current `controlValues` are fetched per workflow at edit time via `get_workflow` (Task 3.x). The above is the target.

---

## Phase 1 — Delete `daily-reminder` end-to-end (code)

### Task 1.1: Remove daily-reminder cron processing

**Files:**
- Delete: `apps/web/app/api/cron/scheduler/daily-reminders.ts`
- Modify: `apps/web/app/api/cron/scheduler/route.ts`

- [ ] **Step 1: Delete the cron file**

```bash
git rm apps/web/app/api/cron/scheduler/daily-reminders.ts
```

- [ ] **Step 2: Remove the import and call in `route.ts`**

In `apps/web/app/api/cron/scheduler/route.ts`, delete this import line:

```ts
import { processDailyReminderNotifications } from "./daily-reminders";
```

and delete this call (including the blank line above it):

```ts
  await processDailyReminderNotifications(supabase, notifications);
```

- [ ] **Step 3: Verify no other references to the daily-reminders cron remain**

Run: `grep -rn "daily-reminders\|processDailyReminderNotifications" apps/web --include="*.ts"`
Expected: no matches (a `daily-reminders.test.ts` may exist — if so, `git rm` it too and re-run).

### Task 1.2: Remove `notifyDailyReminder` from the web service

**Files:**
- Modify: `apps/web/lib/services/notifications.ts`

- [ ] **Step 1: Delete the `notifyDailyReminder` method**

Remove the entire method (the JSDoc block + method) ending the class:

```ts
  /**
   * Send daily reminder push notification to a user.
   * Called from cron which pre-filters by daily_reminder_enabled — no per-user preference check needed.
   */
  async notifyDailyReminder(userId: string, payload: { dayOfYear: number }): Promise<void> {
    try {
      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.DAILY_REMINDER,
        to: userId,
        payload,
      });
    } catch (error) {
      reportNotificationException("notifyDailyReminder", error as Error, {
        id: userId,
      });
    }
  }
```

(Leave the class closing brace `}` and the `createNotificationService` factory below it intact.)

- [ ] **Step 2: Verify**

Run: `grep -n "notifyDailyReminder\|DAILY_REMINDER" apps/web/lib/services/notifications.ts`
Expected: only the `DAILY_REMINDER:` line in the local `NOTIFICATION_WORKFLOWS` const (removed in Phase 2, Task 2.3) — no method references.

### Task 1.3: Remove DAILY_REMINDER from shared constants

**Files:**
- Modify: `packages/shared/src/constants/notifications.ts`

- [ ] **Step 1: Remove the `DAILY_REMINDER` entry from `NOTIFICATION_WORKFLOWS`**

Delete this line:

```ts
  DAILY_REMINDER: "daily-reminder",
```

(inside `NOTIFICATION_WORKFLOWS`)

- [ ] **Step 2: Remove the `DAILY_REMINDER` entry from `NOTIFICATION_PUSH_TYPES`**

Delete this line:

```ts
  DAILY_REMINDER: "daily-reminder",
```

(inside `NOTIFICATION_PUSH_TYPES`)

- [ ] **Step 3: Remove the daily-reminder route case in `getNotificationRoute`**

Delete:

```ts
      case NOTIFICATION_PUSH_TYPES.DAILY_REMINDER:
        return "/home";
```

- [ ] **Step 4: Verify no dangling references across the repo**

Run: `grep -rn "DAILY_REMINDER" packages apps --include="*.ts" --include="*.tsx" | grep -v "apps/web/novu/workflows/daily-reminder.ts" | grep -v "apps/web/lib/services/notifications.ts"`
Expected: no matches.

### Task 1.4: Commit Phase 1

- [ ] **Step 1: Lint + type-check**

Run: `pnpm lint && pnpm type-check`
Expected: PASS. (If `apps/web/lib/services/notifications.ts` still imports `DAILY_REMINDER_WORKFLOW_ID` from `@/novu/workflows/daily-reminder`, that import is removed in Phase 2; type-check may still pass here because the file isn't deleted yet. If type-check fails on the missing `DAILY_REMINDER` key in the web service local const, proceed to Phase 2 first, then commit Phases 1+2 together.)

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(novu): remove daily-reminder notification end-to-end"
```

---

## Phase 2 — Delete the bridge / code-first layer (code)

### Task 2.1: Repoint web service workflow-ID constants to shared constants

**Files:**
- Modify: `apps/web/lib/services/notifications.ts`

Do this BEFORE deleting `apps/web/novu/` so type-check stays green.

- [ ] **Step 1: Replace the 8 per-workflow imports with the shared import**

Delete these import lines:

```ts
import { ACHIEVEMENT_UNLOCKED_WORKFLOW_ID } from "@/novu/workflows/achievement-unlocked";
import { DAILY_REMINDER_WORKFLOW_ID } from "@/novu/workflows/daily-reminder";
import { GROUP_ACHIEVEMENT_UNLOCKED_WORKFLOW_ID } from "@/novu/workflows/group-achievement-unlocked";
import { GROUP_JOIN_WORKFLOW_ID } from "@/novu/workflows/group-join";
import { LOCATION_SHARING_WORKFLOW_ID } from "@/novu/workflows/location-sharing";
import { RESERVATION_PROMPT_WORKFLOW_ID } from "@/novu/workflows/reservation-prompt";
import { RESERVATION_REMINDER_WORKFLOW_ID } from "@/novu/workflows/reservation-reminder";
import { TENT_CHECKIN_WORKFLOW_ID } from "@/novu/workflows/tent-check-in";
```

Then change the existing shared-constants import to add `NOTIFICATION_WORKFLOWS`:

```ts
import {
  DEFAULT_AVATAR_URL,
  DEV_URL,
  IS_PROD,
  NOTIFICATION_WORKFLOWS,
  PROD_URL,
} from "@prostcounter/shared/constants";
```

- [ ] **Step 2: Delete the local `NOTIFICATION_WORKFLOWS` const + its type**

Delete this whole block (the shared import now provides both):

```ts
/**
 * Notification workflow identifiers
 * These should match the workflow IDs configured in Novu
 */
export const NOTIFICATION_WORKFLOWS = {
  GROUP_JOIN: GROUP_JOIN_WORKFLOW_ID,
  LOCATION_SHARING: LOCATION_SHARING_WORKFLOW_ID,
  TENT_CHECKIN: TENT_CHECKIN_WORKFLOW_ID,
  RESERVATION_REMINDER: RESERVATION_REMINDER_WORKFLOW_ID,
  RESERVATION_CHECKIN_PROMPT: RESERVATION_PROMPT_WORKFLOW_ID,
  ACHIEVEMENT_UNLOCKED: ACHIEVEMENT_UNLOCKED_WORKFLOW_ID,
  GROUP_ACHIEVEMENT_UNLOCKED: GROUP_ACHIEVEMENT_UNLOCKED_WORKFLOW_ID,
  DAILY_REMINDER: DAILY_REMINDER_WORKFLOW_ID,
} as const;

/**
 * Type for notification workflow IDs
 */
export type NotificationWorkflowId =
  (typeof NOTIFICATION_WORKFLOWS)[keyof typeof NOTIFICATION_WORKFLOWS];
```

> Note: the shared `NOTIFICATION_WORKFLOWS` re-exports through this module if other files import `NotificationWorkflowId`/`NOTIFICATION_WORKFLOWS` from `@/lib/services/notifications`. Check next step.

- [ ] **Step 3: Find consumers of the web service's re-exported constant/type**

Run: `grep -rn "NOTIFICATION_WORKFLOWS\|NotificationWorkflowId" apps/web --include="*.ts" --include="*.tsx" | grep -v "lib/services/notifications.ts"`
For each match that imports from `@/lib/services/notifications`, repoint it to `@prostcounter/shared/constants`. If there are none, continue.

### Task 2.2: Delete the bridge route and code-first workflow files

**Files:**
- Delete: `apps/web/app/api/novu/route.ts`
- Delete: `apps/web/novu/` (entire directory: `workflows/*.ts`, `workflows/index.ts`, `README.md`, `tsconfig.json`)

- [ ] **Step 1: Delete**

```bash
git rm apps/web/app/api/novu/route.ts
git rm -r apps/web/novu
```

- [ ] **Step 2: Confirm the identify route is untouched**

Run: `test -f apps/web/app/api/novu/identify/route.ts && echo KEPT`
Expected: `KEPT`.

- [ ] **Step 3: Verify no remaining imports from `@/novu/`**

Run: `grep -rn "@/novu/\|@novu/framework" apps/web --include="*.ts" --include="*.tsx"`
Expected: no matches.

### Task 2.3: Remove the sync script and `@novu/framework` dependency

**Files:**
- Delete: `scripts/novu-sync.ts`
- Modify: `package.json` (root) — remove the `novu:sync` script if present
- Modify: `apps/web/package.json` — remove `@novu/framework`

- [ ] **Step 1: Delete the sync script**

```bash
git rm scripts/novu-sync.ts
```

- [ ] **Step 2: Remove the `novu:sync` npm script**

Run: `grep -rn "novu-sync\|novu:sync" package.json apps/web/package.json`
Delete any matching script line(s) from the relevant `package.json` `"scripts"` block.

- [ ] **Step 3: Remove the dependency**

In `apps/web/package.json`, delete the line:

```json
    "@novu/framework": "^2.10.0",
```

- [ ] **Step 4: Reinstall to update the lockfile**

Run: `pnpm install`
Expected: completes; `pnpm-lock.yaml` updated, no `@novu/framework` references for apps/web.

- [ ] **Step 5: Verify**

Run: `grep -rn "novu/framework\|novu-sync\|novu:sync" . --include="*.json" --include="*.ts" | grep -v node_modules`
Expected: no matches.

### Task 2.4: Commit Phase 2

- [ ] **Step 1: Lint + type-check**

Run: `pnpm lint && pnpm type-check`
Expected: PASS.

- [ ] **Step 2: Run web + api tests**

Run: `pnpm test --filter=@prostcounter/api`
Expected: PASS. Then run the web scheduler tests if present: `pnpm --filter=web test app/api/cron/scheduler` (or repo equivalent). Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(novu): remove bridge route, code-first workflows, sync script"
```

---

## Phase 3 — Reconcile dashboard templates (cloud: dev → prod)

For EACH workflow in the Reconciliation reference table (8 workflows; `daily-reminder` is excluded — it's deleted in Phase 5). Do dev first, verify, then prod. Use the MCP `update_workflow` tool which requires the full workflow object (`name`, `workflowId`, `origin: "novu-cloud"`, `steps[]`); fetch current state first and only change `controlValues` strings.

> `update_workflow` enforces `{{payload.variableName}}` syntax. Keep `data` objects (e.g. `{ "type": "friend-request" }`) and `primaryAction`/`redirect` blocks as-is unless the table says otherwise.

### Task 3.1 (template for each workflow): Reconcile `<workflow-id>` in DEV

Repeat this task body for: `friend-request`, `tent-check-in-notification`, `group-join-notification`, `location-sharing-notification`, `achievement-unlocked`, `group-achievement-unlocked`, `reservation-reminder-notification`, `reservation-check-in-prompt`.

- [ ] **Step 1: Fetch current dev workflow**

Call `mcp__novu__get_workflow` with `{ "workflowId": "<workflow-id>" }`.
Record each step's current `controlValues`.

- [ ] **Step 2: Diff against canonical keys**

Compare every `{{payload.X}}` in each step's `subject`/`body`/`avatar`/`redirect.url` against the canonical keys for this workflow in the Reconciliation reference table. List the exact substitutions needed (e.g. `senderName`→`requesterName`). If a referenced key is NOT in the canonical set and cannot be mapped, rewrite that sentence to drop it (don't leave an unresolved variable).

- [ ] **Step 3: Apply the update in dev**

Call `mcp__novu__update_workflow` with the full workflow (`name`, `workflowId`, `origin: "novu-cloud"`, `tags`, and the full `steps[]` array with corrected `controlValues`). Preserve `_id` on each step so steps are updated, not recreated.

- [ ] **Step 4: Verify render in dev**

Call `mcp__novu__trigger_workflow` with `subscriberId` = a dev test subscriber (e.g. `user1@example.com`'s id from `find_subscribers`) and a representative `payload` using the canonical keys (real-looking values). Then call `mcp__novu__get_notifications` (or check the dev Inbox) and confirm the rendered in-app subject/body and push subject/body contain the substituted values with NO literal `{{payload...}}` left and no blanks.

### Task 3.2 (template for each workflow): Promote `<workflow-id>` to PROD

After the dev version of a given workflow is verified:

- [ ] **Step 1: Fetch current prod workflow**

Call `mcp__novu-prod__get_workflow` with `{ "workflowId": "<workflow-id>" }` (prod has different `_id`s/slugs than dev — always use prod's own values).

- [ ] **Step 2: Apply the same `controlValues` substitutions in prod**

Call `mcp__novu-prod__update_workflow` with prod's full workflow object, applying the identical `{{payload.X}}` corrections (preserve prod's own step `_id`s).

- [ ] **Step 3: Verify in prod**

Call `mcp__novu-prod__trigger_workflow` against a known prod test subscriber (confirm one via `mcp__novu-prod__find_subscribers`; use your own account id) with a representative payload, and confirm rendered output has no unresolved variables. For push, verify on a real device if possible.

> Do NOT trigger prod workflows against real end-users. Use only your own/test subscriber.

### Task 3.3: Checkpoint after all 8 reconciled

- [ ] **Step 1:** Confirm all 8 workflows reconciled + verified in BOTH dev and prod. Note any workflow where a trigger field had to be added in code instead (none expected per the table; if one arises, add it as a code task and re-run Phase 2.4 lint/type-check/commit).

---

## Phase 4 — Push integration hygiene (cloud)

### Task 4.1: Set Expo Push as primary in DEV

- [ ] **Step 1: Get the dev Expo integration id**

Call `mcp__novu__get_integrations`. Find the object with `providerId: "expo"` / `identifier: "expo-push"` and copy its `_id` (dev: `69d8d4a3d5bbdb1d88321963` as of 2026-06-02 — re-confirm, don't hardcode blindly).

- [ ] **Step 2: Set primary**

Call `mcp__novu__set_primary_integration` with `{ "integrationId": "<dev-expo-_id>" }`.

- [ ] **Step 3: Verify**

Call `mcp__novu__get_integrations`; confirm the `expo` push integration now has `primary: true` and `fcm` remains `active: true`.

### Task 4.2: Set Expo Push as primary in PROD

- [ ] **Step 1: Get the prod Expo integration id**

Call `mcp__novu-prod__get_integrations`. Find `providerId: "expo"` / `identifier: "expo-push"` and copy its `_id` (prod: `6980bb5b1de5f830e810aa05` as of 2026-06-02 — re-confirm).

- [ ] **Step 2: Set primary**

Call `mcp__novu-prod__set_primary_integration` with `{ "integrationId": "<prod-expo-_id>" }`.

- [ ] **Step 3: Verify**

Call `mcp__novu-prod__get_integrations`; confirm `expo` push is `primary: true`, `fcm` (`firebase-cloud-messaging-native-prod`) remains `active: true` (decision 2026-06-02: keep FCM as fallback). No code/env change needed.

---

## Phase 5 — Cloud cleanup

### Task 5.1: Delete the `daily-reminder` workflow (dev + prod)

Do this only AFTER Phase 1+2 code is committed (so nothing triggers it).

- [ ] **Step 1: Deactivate first (dev)**

Call `mcp__novu__update_workflow` for `daily-reminder` with `active: false` (full object, origin `novu-cloud`). Then `mcp__novu__delete_workflow` `{ "workflowId": "daily-reminder" }`.

- [ ] **Step 2: Deactivate + delete (prod)**

Call `mcp__novu-prod__update_workflow` for `daily-reminder` with `active: false`, then `mcp__novu-prod__delete_workflow` `{ "workflowId": "daily-reminder" }`.

- [ ] **Step 3: Verify**

`mcp__novu__get_workflows` and `mcp__novu-prod__get_workflows`; confirm `daily-reminder` is gone from both. Expected remaining real workflows: 8.

### Task 5.2: Delete the 6 inactive onboarding demo workflows (DEV only)

Prod has none — do NOT run against prod.

- [ ] **Step 1: Delete each**

For each id, call `mcp__novu__delete_workflow`:
`demo-comment-on-task`, `demo-verify-otp`, `demo-apartment-review`, `demo-recent-login`, `demo-password-reset`, `a-new-member-joining-the-team`.

- [ ] **Step 2: Verify**

`mcp__novu__get_workflows`; confirm only the 8 real workflows remain in dev.

### Task 5.3: Fix the stale dev bridge URL

The dev Development environment `bridge.url` points at `deploy-preview-8--onboarding-sandbox.netlify.app/api/novu` (leftover). With the bridge concept removed, this is inert, but clean it up.

- [ ] **Step 1: Attempt to clear via dashboard**

There is no dedicated MCP tool to edit the environment bridge URL. Clear it in the Novu dashboard (Settings → Environments → Development → Bridge/Echo endpoint), or leave it — it has no effect now that no workflow is bridge-origin. Record the decision in the PR description.

---

## Phase 6 — Final verification

### Task 6.1: Repo verification

- [ ] **Step 1: Lint + type-check (whole repo)**

Run: `pnpm lint && pnpm type-check`
Expected: PASS, no errors.

- [ ] **Step 2: Tests**

Run: `pnpm test`
Expected: PASS. Pay attention to `packages/api/src/routes/__tests__/notification.route.test.ts` and the cron scheduler tests.

- [ ] **Step 3: Confirm no Novu drift artifacts remain**

Run: `grep -rn "@novu/framework\|@/novu/\|novu-sync\|notifyDailyReminder\|DAILY_REMINDER" . --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules`
Expected: no matches.

### Task 6.2: Cloud verification summary

- [ ] **Step 1:** Confirm, via `get_workflows` on both `novu` and `novu-prod`: exactly 8 active workflows, all reconciled, `daily-reminder` gone.
- [ ] **Step 2:** Confirm, via `get_integrations` on both: `expo` push `primary: true`, `fcm` `active: true`.
- [ ] **Step 3:** Confirm at least `friend-request` renders a real name in both dev and prod (the original reported bug).

### Task 6.3: Update project memory

**Files:**
- Modify: `/Users/ignacioguri/.claude-personal/projects/-Users-ignacioguri-Documents-Repos-oktoberfest-attendance/memory/novu-migration-status.md`

- [ ] **Step 1:** Update the memory to record: drift resolved; cloud is source of truth; bridge/framework/sync removed; daily-reminder deleted; Expo push primary, FCM kept as fallback; both dev+prod reconciled.

### Task 6.4: Open PR (only when the user asks)

- [ ] **Step 1:** Per CLAUDE.md, do not push unless asked. When asked, push `chore/novu-drift-resolution` and open a PR summarizing: source-of-truth decision, the two live bugs fixed (friend-request blank name, daily-reminder removal), template reconciliation, push-integration primary change, and the dev-bridge-URL note.

---

## Notes / risks carried from the spec

- No workflow IDs change → triggers keep working throughout.
- Code deletions are inert (bridge already bypassed since workflows are `novu-cloud` origin).
- Prod is edited directly via `novu-prod` MCP; always use prod's own `_id`/slug values from `get_workflow`, never dev's.
- Two notification services remain (by design); both were audited. Consolidation is out of scope.
- The `@novu/api` `ResponseValidationError` workaround in `packages/shared/src/utils/novu.ts` is intentionally left as-is.
