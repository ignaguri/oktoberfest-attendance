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

export type ClientPlatform = "ios" | "android" | "web";

const CLIENT_PLATFORMS: ReadonlySet<string> = new Set<ClientPlatform>(["ios", "android", "web"]);
const MAX_CLIENT_VERSION_LENGTH = 32;

/** X-Client-Platform, or undefined for anything the apps do not send. */
export function parseClientPlatformHeader(value: string | undefined): ClientPlatform | undefined {
  if (value === undefined || !CLIENT_PLATFORMS.has(value)) {
    return undefined;
  }
  return value as ClientPlatform;
}

/** X-Client-Version, bounded; undefined when empty. */
export function parseClientVersionHeader(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.slice(0, MAX_CLIENT_VERSION_LENGTH);
}
