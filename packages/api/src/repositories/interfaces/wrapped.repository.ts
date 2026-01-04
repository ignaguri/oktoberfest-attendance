import type { WrappedData } from "@prostcounter/shared";

/**
 * Wrapped repository interface
 * Provides data access for wrapped statistics
 */
export interface IWrappedRepository {
  /**
   * Get cached wrapped data for a user and festival
   * @param userId - User ID
   * @param festivalId - Festival ID
   * @returns Wrapped data if cached, null otherwise
   */
  getCached(userId: string, festivalId: string): Promise<WrappedData | null>;

  /**
   * Generate wrapped data for a user and festival
   * @param userId - User ID
   * @param festivalId - Festival ID
   * @param force - Force regeneration even if cached
   * @returns Generated wrapped data
   */
  generate(
    userId: string,
    festivalId: string,
    force?: boolean,
  ): Promise<WrappedData>;

  /**
   * Invalidate wrapped cache for a user and festival
   * @param userId - User ID
   * @param festivalId - Festival ID (optional - if not provided, invalidates all)
   */
  invalidateCache(userId: string, festivalId?: string): Promise<void>;

  /**
   * Check if wrapped data exists and is fresh
   * @param userId - User ID
   * @param festivalId - Festival ID
   * @returns True if cached data exists and is recent
   */
  isCached(userId: string, festivalId: string): Promise<boolean>;
}
