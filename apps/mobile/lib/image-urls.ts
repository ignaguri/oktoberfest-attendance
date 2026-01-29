/**
 * Mobile image URL utilities
 * Uses direct Supabase storage URLs
 */

import {
  createGetAvatarUrl,
  createGetBeerPictureUrl,
} from "@prostcounter/shared";

import { supabaseUrl } from "./supabase";

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
