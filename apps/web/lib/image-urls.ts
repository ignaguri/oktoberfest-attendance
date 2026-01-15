/**
 * Web image URL utilities
 * Uses API proxy strategy for server-side caching
 */

import {
  createGetAvatarUrl,
  createGetBeerPictureUrl,
} from "@prostcounter/shared";

/**
 * Gets the correct avatar URL for web
 * Uses /api/image/ proxy route for caching benefits
 */
export const getAvatarUrl = createGetAvatarUrl({ strategy: "api-proxy" });

/**
 * Gets the correct beer picture URL for web
 * Uses /api/image/ proxy route for caching benefits
 */
export const getBeerPictureUrl = createGetBeerPictureUrl({
  strategy: "api-proxy",
});
