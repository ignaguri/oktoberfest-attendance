/**
 * Business logic hooks for achievement data
 *
 * Migrated to use Hono API client instead of server actions
 */

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";

/**
 * Hook to fetch user's achievements for a specific festival
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
 * Hook to fetch all available achievements
 * Note: API endpoint returns all achievements, filtering can be done on client
 */
export function useAvailableAchievements() {
  return useQuery(
    QueryKeys.achievements(),
    async () => {
      // Fetch without festival filter to get all available achievements
      const response = await apiClient.achievements.list({});
      return response.data || [];
    },
    {
      staleTime: 60 * 60 * 1000, // 1 hour - available achievements rarely change
      gcTime: 2 * 60 * 60 * 1000, // 2 hours cache
    },
  );
}
