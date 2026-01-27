import type { FestivalTent, NearbyTent } from "@prostcounter/shared";

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

  /**
   * Find tents near a given location using PostGIS
   * @param latitude - User's latitude
   * @param longitude - User's longitude
   * @param radiusMeters - Search radius in meters (default 100)
   * @param festivalId - Optional festival ID for pricing
   * @returns Array of nearby tents sorted by distance
   */
  getNearbyTents(
    latitude: number,
    longitude: number,
    radiusMeters?: number,
    festivalId?: string,
  ): Promise<NearbyTent[]>;
}
