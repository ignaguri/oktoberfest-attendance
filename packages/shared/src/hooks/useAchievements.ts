/**
 * Shared hooks for achievement data
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import { useApiClient, useQuery, QueryKeys } from "../data";

/**
 * Hook to fetch user's unlocked achievements for a specific festival
 */
export function useUserAchievements(festivalId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.userAchievements("current", festivalId || ""),
    async () => {
      const response = await apiClient.achievements.list({ festivalId });
      return response.data || [];
    },
    {
      enabled: !!festivalId,
      staleTime: 1 * 60 * 1000, // 1 minute - achievements unlock during festival
      gcTime: 10 * 60 * 1000, // 10 minutes cache
      refetchOnWindowFocus: true, // Refresh when returning to tab
    },
  );
}

/**
 * Hook to fetch all achievements with progress info (locked + unlocked)
 * Used on the achievements page to show progress toward locked achievements
 */
export function useAchievementsWithProgress(festivalId?: string) {
  const apiClient = useApiClient();

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
      staleTime: 1 * 60 * 1000, // 1 minute - show fresh progress
      gcTime: 10 * 60 * 1000, // 10 minutes cache
      refetchOnWindowFocus: true, // Refresh when returning to tab
    },
  );
}

/**
 * Hook to fetch achievement leaderboard
 */
export function useAchievementLeaderboard(festivalId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    [...QueryKeys.achievements(), "leaderboard", festivalId || ""],
    async () => {
      const response = await apiClient.achievements.leaderboard(festivalId!);
      return response.data || [];
    },
    {
      enabled: !!festivalId,
      staleTime: 2 * 60 * 1000, // 2 minutes - competitive achievement rankings
      gcTime: 15 * 60 * 1000, // 15 minutes cache
      refetchOnWindowFocus: true, // Refresh when returning to tab
    },
  );
}

/**
 * Hook to fetch all available achievements (without user progress)
 */
export function useAvailableAchievements() {
  const apiClient = useApiClient();

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
