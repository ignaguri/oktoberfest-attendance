/**
 * Mobile image URL utilities
 * Uses direct Supabase storage URLs
 */

import {
  createGetAvatarUrl,
  createGetBeerPictureUrl,
} from "@prostcounter/shared";

import { logger } from "./logger";
import { supabaseUrl } from "./supabase";

// Log the supabaseUrl being used for image URLs
logger.debug("Image URL Configuration", {
  supabaseUrl,
  urlLength: supabaseUrl?.length || 0,
});

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
