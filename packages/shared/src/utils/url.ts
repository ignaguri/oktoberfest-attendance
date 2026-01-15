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
