/**
 * Business logic hooks for activity feed data
 *
 * These hooks handle all activity feed-related functionality
 */

import { getActivityFeed } from "@/lib/actions/activity-feed";
import { useQuery } from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";
import { useState, useCallback, useEffect } from "react";

export interface ActivityFeedItem {
  user_id: string;
  festival_id: string;
  activity_type:
    | "beer_count_update"
    | "tent_checkin"
    | "photo_upload"
    | "group_join"
    | "achievement_unlock";
  activity_data: Record<string, any>;
  activity_time: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
}

export interface ActivityFeedResponse {
  activities: ActivityFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Hook to fetch activity feed for a specific festival
 */
export function useActivityFeed(festivalId?: string, cursor?: string) {
  return useQuery(
    QueryKeys.activityFeed(festivalId || ""),
    () => getActivityFeed(festivalId!, cursor),
    {
      enabled: !!festivalId,
      staleTime: 30 * 1000, // 30 seconds - activity feed should be relatively fresh
      gcTime: 5 * 60 * 1000, // 5 minutes cache
    },
  );
}

/**
 * Hook to get activity feed items with pagination support
 */
export function useActivityFeedItems(festivalId?: string) {
  const [allActivities, setAllActivities] = useState<ActivityFeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasLoadedMore, setHasLoadedMore] = useState(false);

  const query = useQuery(
    [...QueryKeys.activityFeed(festivalId || ""), cursor || "initial"],
    () => getActivityFeed(festivalId!, cursor || undefined),
    {
      enabled: !!festivalId,
      staleTime: 30 * 1000, // 30 seconds - activity feed should be relatively fresh
      gcTime: 5 * 60 * 1000, // 5 minutes cache
    },
  );

  // Update activities when new data arrives
  useEffect(() => {
    if (query.data?.activities) {
      if (cursor === null) {
        // First load
        setAllActivities(query.data.activities);
      } else {
        // Append new activities for pagination
        setAllActivities((prev) => [...prev, ...query.data!.activities]);
      }
    }
  }, [query.data?.activities, cursor]);

  const fetchNextPage = useCallback(() => {
    if (query.data?.hasMore && query.data?.nextCursor && !query.loading) {
      setCursor(query.data.nextCursor);
      setHasLoadedMore(true);
    }
  }, [query.data?.hasMore, query.data?.nextCursor, query.loading]);

  return {
    ...query,
    activities: allActivities,
    hasNextPage: query.data?.hasMore || false,
    fetchNextPage,
    isFetchingNextPage: hasLoadedMore && query.loading,
    totalCount: allActivities.length,
  };
}
