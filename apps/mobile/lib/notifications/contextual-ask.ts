import type { NotificationPermissionStatus } from "@/lib/auth/secure-storage";

export type NotificationAskTrigger = "friend_request" | "day_plan" | "group_join";

export interface ContextualAskState {
  declineCount: number;
  /** ISO timestamp of the most recent decline, or null if never declined. */
  lastDeclinedAt: string | null;
}

export const EMPTY_CONTEXTUAL_ASK_STATE: ContextualAskState = {
  declineCount: 0,
  lastDeclinedAt: null,
};

/** Lets the action's own feedback (toast, sheet closing) settle before the dialog appears. */
export const CONTEXTUAL_ASK_OPEN_DELAY_MS = 600;

/** Translation sub-key under notifications.ask for each trigger. */
export const CONTEXTUAL_ASK_COPY_KEY = {
  friend_request: "friendRequest",
  day_plan: "dayPlan",
  group_join: "groupJoin",
} as const satisfies Record<NotificationAskTrigger, string>;

/** Reads the stored state. Anything missing or malformed counts as never asked. */
export function parseContextualAskState(raw: string | null): ContextualAskState {
  if (!raw) {
    return EMPTY_CONTEXTUAL_ASK_STATE;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_CONTEXTUAL_ASK_STATE;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return EMPTY_CONTEXTUAL_ASK_STATE;
  }
  const { declineCount, lastDeclinedAt } = parsed as Record<string, unknown>;
  const isValidCount =
    typeof declineCount === "number" && Number.isInteger(declineCount) && declineCount >= 0;
  const isValidTimestamp =
    lastDeclinedAt === null ||
    (typeof lastDeclinedAt === "string" && !Number.isNaN(Date.parse(lastDeclinedAt)));
  if (!isValidCount || !isValidTimestamp) {
    return EMPTY_CONTEXTUAL_ASK_STATE;
  }
  return { declineCount, lastDeclinedAt };
}

export function withDecline(state: ContextualAskState, now: Date): ContextualAskState {
  return { declineCount: state.declineCount + 1, lastDeclinedAt: now.toISOString() };
}

export type ContextualAskPrimaryOutcome = "registered" | "declined" | "opened_settings";

/**
 * What the dialog's primary button does. Denied can only be fixed in device
 * settings, and we cannot see what the user does there, so that path records
 * nothing; the foreground permission re-check picks up a real change.
 */
export async function runContextualAskPrimary(deps: {
  permissionStatus: NotificationPermissionStatus;
  requestPermission: () => Promise<boolean>;
  register: () => Promise<boolean>;
  openSettings: () => Promise<void>;
  recordDecline: () => Promise<void>;
}): Promise<ContextualAskPrimaryOutcome> {
  if (deps.permissionStatus === "denied") {
    await deps.openSettings();
    return "opened_settings";
  }
  const isGranted = await deps.requestPermission();
  if (!isGranted) {
    await deps.recordDecline();
    return "declined";
  }
  await deps.register();
  return "registered";
}
