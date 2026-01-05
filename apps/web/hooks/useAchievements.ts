/**
 * Business logic hooks for achievement data
 *
 * Migrated to use Hono API client instead of server actions
 */

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";

/**
 * Hook to fetch user's unlocked achievements for a specific festival
 */
export function useUserAchievements(festivalId?: string) {
  return useQuery(
    QueryKeys.userAchievements("current", festivalId || ""),
    async () => {
      const response = await apiClient.achievements.list({ festivalId });
      return response.data || [];
    },
    {
      enabled: !!festivalId,
      staleTime: 2 * 60 * 1000, // 2 minutes - achievements can change based on activity
      gcTime: 10 * 60 * 1000, // 10 minutes cache
    },
  );
}

/**
 * Hook to fetch all achievements with progress info (locked + unlocked)
 * Used on the achievements page to show progress toward locked achievements
 */
export function useAchievementsWithProgress(festivalId?: string) {
  return useQuery(
    [
      ...QueryKeys.userAchievements("current", festivalId || ""),
      "with-progress",
    ],
    async () => {
      const response = await apiClient.achievements.getWithProgress(
        festivalId!,
      );
      return response;
    },
    {
      enabled: !!festivalId,
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes cache
    },
  );
}

/**
 * Hook to fetch achievement leaderboard
 */
export function useAchievementLeaderboard(festivalId?: string) {
  return useQuery(
    [...QueryKeys.achievements(), "leaderboard", festivalId || ""],
    async () => {
      const response = await apiClient.achievements.leaderboard(festivalId!);
      return response.data || [];
    },
    {
      enabled: !!festivalId,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes cache
    },
  );
}

/**
 * Hook to fetch all available achievements (without user progress)
 */
export function useAvailableAchievements() {
  return useQuery(
    [...QueryKeys.achievements(), "available"],
    async () => {
      const response = await apiClient.achievements.available();
      return response.data || [];
    },
    {
      staleTime: 60 * 60 * 1000, // 1 hour - available achievements rarely change
      gcTime: 2 * 60 * 60 * 1000, // 2 hours cache
    },
  );
}
