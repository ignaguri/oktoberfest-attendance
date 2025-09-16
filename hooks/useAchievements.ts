/**
 * Business logic hooks for achievement data
 *
 * These hooks handle all achievement-related functionality
 */

import {
  getUserAchievements,
  getAvailableAchievements,
} from "@/lib/actions/achievements";
import { useQuery } from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";

/**
 * Hook to fetch user's achievements for a specific festival
 */
export function useUserAchievements(festivalId?: string) {
  return useQuery(
    QueryKeys.userAchievements("current", festivalId || ""),
    () => getUserAchievements(festivalId!),
    {
      enabled: !!festivalId,
      staleTime: 2 * 60 * 1000, // 2 minutes - achievements can change based on activity
      cacheTime: 10 * 60 * 1000, // 10 minutes cache
    },
  );
}

/**
 * Hook to fetch all available achievements
 */
export function useAvailableAchievements() {
  return useQuery(QueryKeys.achievements(), () => getAvailableAchievements(), {
    staleTime: 60 * 60 * 1000, // 1 hour - available achievements rarely change
    cacheTime: 2 * 60 * 60 * 1000, // 2 hours cache
  });
}
