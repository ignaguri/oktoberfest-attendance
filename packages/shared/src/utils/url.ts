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
export function replaceLocalhostInUrl(
  url: string,
  supabaseUrl: string,
): string {
  try {
    const supabaseHost = new URL(supabaseUrl).host;
    return url
      .replace(/localhost:\d+/g, supabaseHost)
      .replace(/127\.0\.0\.1:\d+/g, supabaseHost);
  } catch {
    // If URL parsing fails, return original URL
    return url;
  }
}
