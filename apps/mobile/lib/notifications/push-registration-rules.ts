type PermissionStatus = "undetermined" | "granted" | "denied";

export function shouldSyncPushRegistration(input: {
  isAuthenticated: boolean;
  isPermissionLoading: boolean;
  permissionStatus: PermissionStatus;
  alreadySynced: boolean;
  isWeb: boolean;
  userId: string | null;
  lastAttemptedUserId: string | null;
}): boolean {
  return (
    input.isAuthenticated &&
    !input.isPermissionLoading &&
    input.permissionStatus === "granted" &&
    !input.alreadySynced &&
    !input.isWeb &&
    input.userId !== null &&
    input.userId !== input.lastAttemptedUserId
  );
}

export function shouldShowFestivalAlertCard(input: {
  phase: "upcoming" | "live" | "ended" | null;
  permissionStatus: PermissionStatus;
  isPermissionLoading: boolean;
  dismissed: boolean;
  isWeb: boolean;
}): boolean {
  return (
    (input.phase === "upcoming" || input.phase === "live") &&
    input.permissionStatus !== "granted" &&
    !input.isPermissionLoading &&
    !input.dismissed &&
    !input.isWeb
  );
}

export const CONTEXTUAL_ASK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const CONTEXTUAL_ASK_MAX_DECLINES = 3;

/**
 * Whether to offer notifications right after an action that has an obvious
 * payoff (a friend request, a day plan, a group join). Denied still asks: the
 * dialog then offers device settings instead of the OS prompt.
 */
export function shouldShowContextualAsk(input: {
  permissionStatus: PermissionStatus;
  isPermissionLoading: boolean;
  isWeb: boolean;
  declineCount: number;
  lastDeclinedAt: Date | null;
  hasAskedThisSession: boolean;
  now: Date;
}): boolean {
  if (input.isWeb || input.isPermissionLoading || input.permissionStatus === "granted") {
    return false;
  }
  if (input.hasAskedThisSession) {
    return false;
  }
  if (input.declineCount >= CONTEXTUAL_ASK_MAX_DECLINES) {
    return false;
  }
  if (input.lastDeclinedAt === null) {
    return true;
  }
  return input.now.getTime() - input.lastDeclinedAt.getTime() >= CONTEXTUAL_ASK_COOLDOWN_MS;
}

/**
 * Re-checked when the open delay ends, since state can move during it. Any
 * false here drops the ask silently: no decline recorded, session not marked.
 * An undetermined permission with the launch prompt not yet shown means that
 * prompt is about to open (often at cold start via a deep link), so the
 * contextual ask yields to it instead of stacking a second dialog.
 */
export function shouldOpenPendingContextualAsk(input: {
  hasAskedThisSession: boolean;
  canShowLaunchPopups: boolean;
  requestingUserId: string;
  currentUserId: string | null;
  permissionStatus: PermissionStatus;
  isPermissionLoading: boolean;
  hasLaunchPromptBeenShown: boolean;
}): boolean {
  if (input.hasAskedThisSession || !input.canShowLaunchPopups) {
    return false;
  }
  if (input.currentUserId !== input.requestingUserId) {
    return false;
  }
  if (input.isPermissionLoading || input.permissionStatus === "granted") {
    return false;
  }
  if (!input.hasLaunchPromptBeenShown && input.permissionStatus === "undetermined") {
    return false;
  }
  return true;
}
