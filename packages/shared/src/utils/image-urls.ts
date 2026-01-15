/**
 * Shared image URL utilities for web and mobile
 * Provides factory functions to create platform-specific URL builders
 */

export type ImageUrlStrategy = "api-proxy" | "direct-storage";

export interface ImageUrlConfig {
  /** Strategy to use for building URLs */
  strategy: ImageUrlStrategy;
  /** Supabase URL - required for direct-storage strategy */
  supabaseUrl?: string;
}

/**
 * Creates a function to get avatar URLs
 *
 * @param config - Configuration for URL building
 * @returns Function that converts avatar filename/URL to displayable URL
 *
 * @example
 * ```ts
 * // Web (uses API proxy for caching)
 * const getAvatarUrl = createGetAvatarUrl({ strategy: "api-proxy" });
 *
 * // Mobile (direct Supabase storage)
 * const getAvatarUrl = createGetAvatarUrl({
 *   strategy: "direct-storage",
 *   supabaseUrl: "https://xyz.supabase.co"
 * });
 * ```
 */
export function createGetAvatarUrl(config: ImageUrlConfig) {
  return (avatarUrl: string | null | undefined): string | undefined => {
    if (!avatarUrl) return undefined;

    // If it's already a full URL (from OAuth providers), return as-is
    if (avatarUrl.startsWith("http")) {
      return avatarUrl;
    }

    // Build URL based on strategy
    if (config.strategy === "api-proxy") {
      return `/api/image/${avatarUrl}`;
    }

    // direct-storage strategy
    return `${config.supabaseUrl}/storage/v1/object/public/avatars/${avatarUrl}`;
  };
}

/**
 * Creates a function to get beer picture URLs
 *
 * @param config - Configuration for URL building
 * @returns Function that converts picture filename/URL to displayable URL
 *
 * @example
 * ```ts
 * // Web (uses API proxy for caching)
 * const getBeerPictureUrl = createGetBeerPictureUrl({ strategy: "api-proxy" });
 *
 * // Mobile (direct Supabase storage)
 * const getBeerPictureUrl = createGetBeerPictureUrl({
 *   strategy: "direct-storage",
 *   supabaseUrl: "https://xyz.supabase.co"
 * });
 * ```
 */
export function createGetBeerPictureUrl(config: ImageUrlConfig) {
  return (pictureUrl: string | null | undefined): string | undefined => {
    if (!pictureUrl) return undefined;

    // If it's already a full URL, return as-is
    if (pictureUrl.startsWith("http")) {
      return pictureUrl;
    }

    // Build URL based on strategy
    if (config.strategy === "api-proxy") {
      return `/api/image/${pictureUrl}?bucket=beer_pictures`;
    }

    // direct-storage strategy
    return `${config.supabaseUrl}/storage/v1/object/public/beer_pictures/${pictureUrl}`;
  };
}
