/**
 * Shared hooks for activity feed data
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import { useState, useCallback, useEffect } from "react";
import { useApiClient, useQuery, QueryKeys } from "../data";

import type {
  ActivityFeedItem,
  GetActivityFeedResponse,
} from "../schemas";

export type { ActivityFeedItem };

export type ActivityFeedResponse = GetActivityFeedResponse;

/**
 * Hook to fetch activity feed for a specific festival
 */
export function useActivityFeed(festivalId?: string, cursor?: string) {
  const apiClient = useApiClient();

  return useQuery<GetActivityFeedResponse>(
    QueryKeys.activityFeed(festivalId || ""),
    () => apiClient.activityFeed.get({ festivalId: festivalId!, cursor }),
    {
      enabled: !!festivalId,
      staleTime: 30 * 1000, // 30 seconds - activity feed should be relatively fresh
      gcTime: 5 * 60 * 1000, // 5 minutes cache
    }
  );
}

/**
 * Hook to get activity feed items with pagination support
 */
export function useActivityFeedItems(festivalId?: string) {
  const apiClient = useApiClient();
  const [allActivities, setAllActivities] = useState<ActivityFeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasLoadedMore, setHasLoadedMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const query = useQuery<GetActivityFeedResponse>(
    [...QueryKeys.activityFeed(festivalId || ""), cursor || "initial"],
    () =>
      apiClient.activityFeed.get({
        festivalId: festivalId!,
        cursor: cursor || undefined,
      }),
    {
      enabled: !!festivalId,
      staleTime: 30 * 1000, // 30 seconds - activity feed should be relatively fresh
      gcTime: 5 * 60 * 1000, // 5 minutes cache
    }
  );

  // Cast data to proper type for type-safe access
  const data = query.data as GetActivityFeedResponse | null;

  // Update activities when new data arrives
  useEffect(() => {
    if (data?.activities) {
      if (cursor === null || isRefreshing) {
        // First load or refresh - replace all activities
        setAllActivities(data.activities);
      } else {
        // Append new activities for pagination
        setAllActivities((prev) => [...prev, ...data.activities]);
      }
    }
  }, [data?.activities, cursor, isRefreshing]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchNextPage = useCallback(() => {
    if (data?.hasMore && data?.nextCursor && !query.loading) {
      setCursor(data.nextCursor);
      setHasLoadedMore(true);
    }
  }, [data?.hasMore, data?.nextCursor, query.loading]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      // Reset cursor to get fresh data from the beginning
      setCursor(null);
      setHasLoadedMore(false);

      // Trigger refetch
      await query.refetch();

      // Add a small delay to ensure the refresh animation is visible
      // even if the query completes quickly
      await new Promise((resolve) => setTimeout(resolve, 800));
    } catch {
      // If refresh fails, we keep existing activities
      // Reset cursor to maintain current pagination state
      setCursor(null);
      setHasLoadedMore(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [query]);

  return {
    ...query,
    activities: allActivities,
    hasNextPage: data?.hasMore || false,
    fetchNextPage,
    isFetchingNextPage: hasLoadedMore && query.loading,
    isRefreshing,
    refresh,
    totalCount: allActivities.length,
  };
}
