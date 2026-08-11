import type { ListAchievementsQuery, UserAchievement } from "@prostcounter/shared";

/**
 * Achievement repository interface
 * Provides data access for achievement records
 */
export interface IAchievementRepository {
  /**
   * List user's achievements for a festival
   * @param userId - User ID
   * @param query - Query parameters (festivalId, category)
   * @returns Array of user achievements with details
   */
  listUserAchievements(userId: string, query: ListAchievementsQuery): Promise<UserAchievement[]>;
}
