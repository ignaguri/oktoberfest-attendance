import type { FestivalTent } from "@prostcounter/shared";

/**
 * Tent repository interface
 * Provides data access for tent records
 */
export interface ITentRepository {
  /**
   * List all tents for a festival
   * @param festivalId - Festival ID
   * @returns Array of festival tents with pricing
   */
  listByFestival(festivalId: string): Promise<FestivalTent[]>;

  /**
   * Get tent pricing for a specific tent at a festival
   * @param festivalId - Festival ID
   * @param tentId - Tent ID
   * @returns Festival tent with pricing, or null if not found
   */
  findFestivalTent(
    festivalId: string,
    tentId: string,
  ): Promise<FestivalTent | null>;
}
