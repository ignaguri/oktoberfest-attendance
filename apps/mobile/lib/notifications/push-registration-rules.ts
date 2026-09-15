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
