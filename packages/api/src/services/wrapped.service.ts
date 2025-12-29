import type { WrappedData } from "@prostcounter/shared";
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
    festivalId: string
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
    force = false
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
}
