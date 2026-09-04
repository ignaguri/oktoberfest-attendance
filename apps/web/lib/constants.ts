/**
 * Web-only constants
 * Shared constants are in @prostcounter/shared/constants
 */

import type { SupportedLanguage } from "@prostcounter/shared/i18n";

/**
 * Non-English locales that have their own URL prefix (e.g. /de, /es).
 * Lives here rather than in lib/blog.ts so that proxy.ts can import it without
 * dragging fs/gray-matter/reading-time into the proxy bundle.
 */
export const NON_DEFAULT_LOCALES: SupportedLanguage[] = ["de", "es"];

// Google Analytics tracking ID (web-specific)
export const GA_ID = "G-HL3ZYBCMN2";

export const IOS_APP_STORE_URL = "https://apps.apple.com/app/prostcounter/id6758376527";
export const ANDROID_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.prostcounter.app";
