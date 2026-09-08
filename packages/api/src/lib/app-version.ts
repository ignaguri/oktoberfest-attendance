/**
 * Published mobile app versions, served to the apps so they can prompt for an
 * update.
 *
 * The apps cannot discover this themselves. iOS has the iTunes lookup API but
 * Google publishes no equivalent, so both platforms read it from here instead
 * of one scraping and one not.
 *
 * These are hand-maintained: bump them when a store release goes live (see
 * docs/VERSION_MANAGEMENT.md). Serving a stale `latest` under-prompts, which is
 * harmless; the value that must not drift upward is `minSupported`.
 */

export interface PlatformVersion {
  /** Newest version available in the store. Drives the dismissible prompt. */
  latest: string;
  /** Oldest version the backend still works with. */
  minSupported: string;
}

export interface AppVersions {
  ios: PlatformVersion;
  android: PlatformVersion;
}

/**
 * `minSupported` is 1.6.2 because that is the first build carrying the
 * hCaptcha sitekey. Once captcha is enabled on the Supabase project, anything
 * older sends no token and GoTrue rejects sign-in, sign-up, and password
 * recovery outright. Existing sessions keep working, so this only bites users
 * who need to re-authenticate.
 *
 * There is no iOS 1.7.0 build; iOS tops out at 1.6.2.
 */
export const APP_VERSIONS: AppVersions = {
  ios: { latest: "1.6.2", minSupported: "1.6.2" },
  android: { latest: "1.7.0", minSupported: "1.6.2" },
};

/** Returns a defensive copy so a handler cannot mutate the shared constant. */
export function getAppVersions(): AppVersions {
  return {
    ios: { ...APP_VERSIONS.ios },
    android: { ...APP_VERSIONS.android },
  };
}
