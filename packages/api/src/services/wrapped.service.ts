import type {
  AvailableWrappedFestival,
  WrappedAccessResult,
  WrappedData,
} from "@prostcounter/shared";

import type { IWrappedRepository } from "../repositories/interfaces";

/**
 * Wrapped Service
 * Handles business logic for year-in-review wrapped statistics
 */
export class WrappedService {
  constructor(private wrappedRepo: IWrappedRepository) {}

  /**
   * Get wrapped data for a user and festival
   * Returns cached data if available and recent
   *
   * @param userId - User ID
   * @param festivalId - Festival ID
   * @returns Wrapped data and cache status
   */
  async getWrapped(
    userId: string,
    festivalId: string,
  ): Promise<{ wrapped: WrappedData | null; cached: boolean }> {
    // Try to get cached data first
    const cached = await this.wrappedRepo.getCached(userId, festivalId);

    if (cached) {
      return { wrapped: cached, cached: true };
    }

    // No cached data available
    return { wrapped: null, cached: false };
  }

  /**
   * Generate wrapped data for a user and festival
   * Optionally force regeneration even if cached
   *
   * @param userId - User ID
   * @param festivalId - Festival ID
   * @param force - Force regeneration
   * @returns Generated wrapped data and regeneration flag
   */
  async generateWrapped(
    userId: string,
    festivalId: string,
    force = false,
  ): Promise<{ wrapped: WrappedData; regenerated: boolean }> {
    // Check if we need to regenerate
    const isCached = await this.wrappedRepo.isCached(userId, festivalId);

    if (isCached && !force) {
      // Return existing cached data
      const cached = await this.wrappedRepo.getCached(userId, festivalId);
      return { wrapped: cached!, regenerated: false };
    }

    // Generate new wrapped data
    const wrapped = await this.wrappedRepo.generate(userId, festivalId, force);

    return { wrapped, regenerated: true };
  }

  /**
   * Invalidate wrapped cache for a user
   * Called when user data changes (e.g., new attendance, achievements)
   *
   * @param userId - User ID
   * @param festivalId - Optional festival ID (if omitted, invalidates all)
   */
  async invalidateCache(userId: string, festivalId?: string): Promise<void> {
    await this.wrappedRepo.invalidateCache(userId, festivalId);
  }

  /**
   * Check if user can access wrapped for a festival
   *
   * @param userId - User ID
   * @param festivalId - Festival ID
   * @returns Access result with allowed status and reason
   */
  async checkAccess(
    userId: string,
    festivalId: string,
  ): Promise<WrappedAccessResult> {
    return this.wrappedRepo.checkAccess(userId, festivalId);
  }

  /**
   * Get list of festivals with wrapped available for a user
   *
   * @param userId - User ID
   * @returns List of festivals with wrapped availability status
   */
  async getAvailableFestivals(
    userId: string,
  ): Promise<AvailableWrappedFestival[]> {
    return this.wrappedRepo.getAvailableFestivals(userId);
  }

  /**
   * Admin function to regenerate cached wrapped data
   *
   * @param adminUserId - Admin user ID performing the action
   * @param festivalId - Optional festival ID filter
   * @param userId - Optional user ID filter
   * @returns Number of entries regenerated and success status
   */
  async regenerateCache(
    adminUserId: string,
    festivalId?: string,
    userId?: string,
  ): Promise<{ success: boolean; regeneratedCount: number }> {
    const regeneratedCount = await this.wrappedRepo.regenerateCache(
      adminUserId,
      festivalId,
      userId,
    );

    return {
      success: true,
      regeneratedCount,
    };
  }
}
