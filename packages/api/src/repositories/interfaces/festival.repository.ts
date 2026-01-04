import type { Festival, ListFestivalsQuery } from "@prostcounter/shared";

/**
 * Festival repository interface
 * Provides data access for festival records
 */
export interface IFestivalRepository {
  /**
   * List all festivals with optional filters
   * @param query - Query parameters (status, isActive)
   * @returns Array of festivals
   */
  list(query?: ListFestivalsQuery): Promise<Festival[]>;

  /**
   * Get a festival by ID
   * @param id - Festival ID
   * @returns Festival record, or null if not found
   */
  findById(id: string): Promise<Festival | null>;

  /**
   * Get the active festival
   * @returns Active festival, or null if none is active
   */
  findActive(): Promise<Festival | null>;
}
