/**
 * Avatar URL utilities for mobile
 *
 * Handles constructing proper URLs for avatar images stored in Supabase storage.
 * Matches the web's getAvatarUrl utility pattern.
 */

import Constants from "expo-constants";

/**
 * Get the Supabase URL from environment/constants
 */
function getSupabaseUrl(): string {
  return (
    Constants.expoConfig?.extra?.supabaseUrl ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    "http://localhost:54321"
  );
}

/**
 * Transform an avatar_url value from the database into a displayable URL.
 *
 * - If it's already a full URL (from OAuth providers like Google/Facebook), return as-is
 * - If it's just a filename, construct the Supabase storage public URL
 *
 * @param avatarUrl - The avatar_url value from the profile (filename or full URL)
 * @returns The full URL to display, or undefined if no avatar
 *
 * @example
 * getAvatarUrl("user123_1234567890.webp")
 * // Returns: "http://localhost:54321/storage/v1/object/public/avatars/user123_1234567890.webp"
 *
 * getAvatarUrl("https://lh3.googleusercontent.com/...")
 * // Returns: "https://lh3.googleusercontent.com/..." (unchanged)
 */
export function getAvatarUrl(
  avatarUrl: string | null | undefined,
): string | undefined {
  if (!avatarUrl) return undefined;

  // If it's already a full URL (from Google, Facebook, etc.), return as-is
  if (avatarUrl.startsWith("http")) {
    return avatarUrl;
  }

  // If it's a filename, construct the Supabase storage public URL
  const supabaseUrl = getSupabaseUrl();
  return `${supabaseUrl}/storage/v1/object/public/avatars/${avatarUrl}`;
}
