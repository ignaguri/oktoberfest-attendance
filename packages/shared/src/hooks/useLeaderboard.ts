/**
 * Shared hooks for leaderboard data
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import { useApiClient, useQuery, QueryKeys } from "../data";
import {
  GLOBAL_LEADERBOARD_CRITERIA,
  type GlobalLeaderboardCriteria,
  winningCriteriaFromId,
} from "../schemas/group.schema";

/**
 * Hook to fetch global leaderboard data
 */
export function useGlobalLeaderboard(criteriaId: number, festivalId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.globalLeaderboard(criteriaId, festivalId || ""),
    async () => {
      const criteria = winningCriteriaFromId(criteriaId);
      const sortBy: GlobalLeaderboardCriteria = GLOBAL_LEADERBOARD_CRITERIA.includes(
        criteria as GlobalLeaderboardCriteria,
      )
        ? (criteria as GlobalLeaderboardCriteria)
        : "total_beers";
      const response = await apiClient.leaderboard.global({
        festivalId,
        sortBy,
      });
      return response.data || [];
    },
    {
      enabled: !!festivalId && criteriaId > 0,
      staleTime: 30 * 1000, // 30 seconds - real-time competitive data
      gcTime: 5 * 60 * 1000, // 5 minutes cache
      refetchOnWindowFocus: true, // Refresh when returning to tab
    },
  );
}

/**
 * Hook to fetch group leaderboard data
 */
export function useGroupLeaderboard(groupId: string, criteriaId: number, festivalId: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.groupLeaderboard(groupId, criteriaId, festivalId),
    async () => {
      const response = await apiClient.groups.leaderboard(groupId);
      return response.data || [];
    },
    {
      enabled: !!groupId && !!festivalId && criteriaId > 0,
      staleTime: 30 * 1000, // 30 seconds - real-time competitive data
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true, // Refresh when returning to tab
    },
  );
}

/**
 * Hook to fetch winning criteria options
 */
export function useWinningCriterias() {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.winningCriterias(),
    async () => {
      const response = await apiClient.leaderboard.winningCriteria();
      return response.data || [];
    },
    {
      staleTime: 30 * 60 * 1000, // 30 minutes - winning criteria rarely change
      gcTime: 60 * 60 * 1000, // 1 hour cache
    },
  );
}
