/**
 * Business logic hooks for leaderboard data
 *
 * Migrated to use Hono API client instead of server actions
 */

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";
import { fetchWinningCriterias } from "@/lib/sharedActions";

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
  return useQuery(
    QueryKeys.globalLeaderboard(criteriaId, festivalId || ""),
    async () => {
      const sortBy = CRITERIA_ID_TO_SORT_BY[criteriaId] || "total_beers";
      const response = await apiClient.leaderboard.global({
        festivalId,
        sortBy,
      });
      return response.entries || [];
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
  return useQuery(
    QueryKeys.groupLeaderboard(groupId, criteriaId, festivalId),
    async () => {
      const response = await apiClient.groups.leaderboard(groupId);
      return response.entries || [];
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
 * Note: Still using server action as this is not yet available in API
 * TODO: Migrate to API endpoint when available
 */
export function useWinningCriterias() {
  return useQuery(QueryKeys.winningCriterias(), () => fetchWinningCriterias(), {
    staleTime: 30 * 60 * 1000, // 30 minutes - winning criteria rarely change
    gcTime: 60 * 60 * 1000, // 1 hour cache
  });
}
