/**
 * Shared URL utilities for web and mobile
 */

import { PROD_URL, DEV_URL, IS_PROD } from "../constants/app";

/**
 * Get the application URL based on environment
 *
 * Priority:
 * 1. EXPO_PUBLIC_APP_URL (mobile)
 * 2. NEXT_PUBLIC_VERCEL_URL (web on Vercel)
 * 3. NEXT_PUBLIC_APP_URL (web custom)
 * 4. Production/development fallback based on NODE_ENV
 */
export function getAppUrl(): string {
  // Mobile (Expo)
  if (process.env.EXPO_PUBLIC_APP_URL) {
    return process.env.EXPO_PUBLIC_APP_URL;
  }

  // Web (Next.js) - Vercel provides this automatically
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // Web custom app URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Fallback to constants based on environment
  return IS_PROD ? PROD_URL : DEV_URL;
}

/**
 * Replace localhost/127.0.0.1 in a URL with the actual host from Supabase URL
 * This is needed for mobile devices to access Supabase storage
 *
 * @param url - The URL to fix (e.g., signed upload URL from Supabase)
 * @param supabaseUrl - The Supabase URL from environment (e.g., process.env.SUPABASE_URL)
 * @returns The URL with localhost replaced by the actual host
 */
export function replaceLocalhostInUrl(url: string, supabaseUrl: string): string {
  try {
    const supabaseHost = new URL(supabaseUrl).host;
    return url.replace(/localhost:\d+/g, supabaseHost).replace(/127\.0\.0\.1:\d+/g, supabaseHost);
  } catch {
    // If URL parsing fails, return original URL
    return url;
  }
}

/**
 * Build a shareable group-invite URL. The path "/join-group" is the one the
 * mobile app intercepts via Universal Links / Android App Links (see
 * apps/mobile/app.config.ts intent filters), so every invite URL we share
 * MUST use this path (not "/api/join-group") for deeplinking to work.
 *
 * @param token - Invite token (URL-encoded internally so non-UUID formats are safe).
 * @param baseUrl - Optional origin override. Web callers pass `window.location.origin`
 *                  so the link matches the current browser origin; mobile callers
 *                  omit it to pick up getAppUrl() (EXPO_PUBLIC_APP_URL).
 */
export function buildGroupInviteUrl(token: string, baseUrl?: string): string {
  const origin = baseUrl ?? getAppUrl();
  return `${origin}/join-group?token=${encodeURIComponent(token)}`;
}

/**
 * Parse just the host out of a URL without throwing. Useful for logging /
 * diagnostics where an unparseable input should surface as a sentinel string
 * rather than crash the caller.
 */
export function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "<invalid-url>";
  }
}
