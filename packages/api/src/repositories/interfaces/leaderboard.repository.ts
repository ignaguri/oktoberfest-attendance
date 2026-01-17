import type {
  GlobalLeaderboardQuery,
  GroupLeaderboardQuery,
  LeaderboardEntry,
  WinningCriteriaOption,
} from "@prostcounter/shared";

/**
 * Leaderboard repository interface
 * Provides data access for leaderboard rankings
 */
export interface ILeaderboardRepository {
  /**
   * Get global leaderboard for a festival
   * @param query - Query parameters (festivalId, sortBy, limit, offset)
   * @returns Array of leaderboard entries and total count
   */
  getGlobal(
    query: GlobalLeaderboardQuery,
  ): Promise<{ data: LeaderboardEntry[]; total: number }>;

  /**
   * Get group leaderboard
   * @param groupId - Group ID
   * @param query - Query parameters (sortBy)
   * @returns Array of leaderboard entries
   */
  getForGroup(
    groupId: string,
    query?: GroupLeaderboardQuery,
  ): Promise<LeaderboardEntry[]>;

  /**
   * Get winning criteria options
   * @returns Array of winning criteria options for group competitions
   */
  getWinningCriteria(): Promise<WinningCriteriaOption[]>;
}
