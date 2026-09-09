/**
 * Published mobile app versions, served so the apps can prompt for an update.
 * Hand-maintained -- bump on each store release, see docs/VERSION_MANAGEMENT.md.
 * A stale `latest` just under-prompts; `minSupported` must never drift upward.
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
 * minSupported is 1.6.2, the first build with the hCaptcha sitekey (commit
 * 41d7e3a7); older builds send no token and are rejected once captcha is on.
 * That commit didn't bump the version, so this floor only holds because EAS
 * shows exactly one 1.6.2 build per platform, both from 41d7e3a7 -- re-verify
 * before lowering it.
 *
 * iOS tops out at 1.6.2 in the App Store; Play serves Android 1.7.0.
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
