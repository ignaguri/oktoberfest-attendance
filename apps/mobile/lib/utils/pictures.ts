/**
 * Picture URL utilities for mobile
 *
 * Handles constructing proper URLs for images stored in Supabase storage.
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
 * Transform a picture_url value from the database into a displayable URL.
 *
 * - If it's already a full URL, return as-is
 * - If it's just a filename, construct the Supabase storage public URL
 *
 * @param pictureUrl - The picture_url value from the database (filename or full URL)
 * @param bucket - The storage bucket name (default: "beer_pictures")
 * @returns The full URL to display, or undefined if no picture
 *
 * @example
 * getBeerPictureUrl("user123_1234567890.webp")
 * // Returns: "http://localhost:54321/storage/v1/object/public/beer_pictures/user123_1234567890.webp"
 *
 * getBeerPictureUrl("https://example.com/image.jpg")
 * // Returns: "https://example.com/image.jpg" (unchanged)
 */
export function getBeerPictureUrl(
  pictureUrl: string | null | undefined,
  bucket: string = "beer_pictures"
): string | undefined {
  if (!pictureUrl) return undefined;

  // If it's already a full URL, return as-is
  if (pictureUrl.startsWith("http")) {
    return pictureUrl;
  }

  // If it's a filename, construct the Supabase storage public URL
  const supabaseUrl = getSupabaseUrl();
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${pictureUrl}`;
}
