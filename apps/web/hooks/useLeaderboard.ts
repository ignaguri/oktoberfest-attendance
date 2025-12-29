/**
 * Business logic hooks for leaderboard data
 *
 * These hooks provide a clean API for components to access leaderboard data
 * without knowing about the underlying state management implementation
 */

import { fetchLeaderboard } from "@/app/(private)/groups/actions";
import { fetchGlobalLeaderboard } from "@/app/(private)/leaderboard/actions";
import { useQuery } from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";
import { fetchWinningCriterias } from "@/lib/sharedActions";

/**
 * Hook to fetch global leaderboard data
 */
export function useGlobalLeaderboard(criteriaId: number, festivalId?: string) {
  return useQuery(
    QueryKeys.globalLeaderboard(criteriaId, festivalId || ""),
    () => fetchGlobalLeaderboard(criteriaId, festivalId),
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
    () => fetchLeaderboard(groupId), // Uses existing fetchLeaderboard function
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
  return useQuery(QueryKeys.winningCriterias(), () => fetchWinningCriterias(), {
    staleTime: 30 * 60 * 1000, // 30 minutes - winning criteria rarely change
    gcTime: 60 * 60 * 1000, // 1 hour cache
  });
}
