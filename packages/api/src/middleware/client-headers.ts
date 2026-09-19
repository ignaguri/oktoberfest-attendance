export type PushPermission = "granted" | "denied" | "undetermined";

const PUSH_PERMISSIONS: ReadonlySet<string> = new Set<PushPermission>([
  "granted",
  "denied",
  "undetermined",
]);

/**
 * Reads X-Client-Push-Permission. Only the exact values the mobile app sends
 * are accepted; anything else is treated as absent, because the column has a
 * CHECK constraint and a rejected value would drop the whole active-day upsert.
 */
export function parsePushPermissionHeader(value: string | undefined): PushPermission | undefined {
  if (value === undefined || !PUSH_PERMISSIONS.has(value)) {
    return undefined;
  }
  return value as PushPermission;
}
