/**
 * Shared hooks for leaderboard data
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import { useApiClient, useQuery, QueryKeys } from "../data";

// Map winning criteria IDs to API enum values
const CRITERIA_ID_TO_SORT_BY: Record<
  number,
  "days_attended" | "total_beers" | "avg_beers"
> = {
  1: "days_attended",
  2: "total_beers",
  3: "avg_beers",
};

/**
 * Hook to fetch global leaderboard data
 */
export function useGlobalLeaderboard(criteriaId: number, festivalId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.globalLeaderboard(criteriaId, festivalId || ""),
    async () => {
      const sortBy = CRITERIA_ID_TO_SORT_BY[criteriaId] || "total_beers";
      const response = await apiClient.leaderboard.global({
        festivalId,
        sortBy,
      });
      return response.data || [];
    },
    {
      enabled: !!festivalId && criteriaId > 0,
      staleTime: 2 * 60 * 1000, // 2 minutes - leaderboard changes frequently
      gcTime: 5 * 60 * 1000, // 5 minutes cache
    },
  );
}

/**
 * Hook to fetch group leaderboard data
 */
export function useGroupLeaderboard(
  groupId: string,
  criteriaId: number,
  festivalId: string,
) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.groupLeaderboard(groupId, criteriaId, festivalId),
    async () => {
      const response = await apiClient.groups.leaderboard(groupId);
      return response.data || [];
    },
    {
      enabled: !!groupId && !!festivalId && criteriaId > 0,
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
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
