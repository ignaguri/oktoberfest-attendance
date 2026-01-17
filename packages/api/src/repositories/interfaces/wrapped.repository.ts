import type {
  AvailableWrappedFestival,
  WrappedAccessResult,
  WrappedData,
} from "@prostcounter/shared";

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

  /**
   * Check if user can access wrapped for a festival
   * @param userId - User ID
   * @param festivalId - Festival ID
   * @returns Access result with allowed status and reason
   */
  checkAccess(userId: string, festivalId: string): Promise<WrappedAccessResult>;

  /**
   * Get list of festivals with wrapped available for a user
   * @param userId - User ID
   * @returns List of festivals with wrapped availability status
   */
  getAvailableFestivals(userId: string): Promise<AvailableWrappedFestival[]>;

  /**
   * Admin function to regenerate cached wrapped data
   * @param adminUserId - Admin user ID performing the action
   * @param festivalId - Optional festival ID filter
   * @param userId - Optional user ID filter
   * @returns Number of entries regenerated
   */
  regenerateCache(
    adminUserId: string,
    festivalId?: string,
    userId?: string,
  ): Promise<number>;

  /**
   * Check if user is a super admin
   * @param userId - User ID
   * @returns True if user is a super admin
   */
  isAdmin(userId: string): Promise<boolean>;
}
