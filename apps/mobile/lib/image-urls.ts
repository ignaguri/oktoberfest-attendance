/**
 * Mobile image URL utilities
 * Uses direct Supabase storage URLs
 */

import {
  createGetAvatarUrl,
  createGetBeerPictureUrl,
} from "@prostcounter/shared";
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

const supabaseUrl = getSupabaseUrl();

/**
 * Gets the correct avatar URL for mobile
 * Uses direct Supabase storage public URLs
 */
export const getAvatarUrl = createGetAvatarUrl({
  strategy: "direct-storage",
  supabaseUrl,
});

/**
 * Gets the correct beer picture URL for mobile
 * Uses direct Supabase storage public URLs
 */
export const getBeerPictureUrl = createGetBeerPictureUrl({
  strategy: "direct-storage",
  supabaseUrl,
});
