/**
 * Business logic hooks for activity feed data
 *
 * These hooks handle all activity feed-related functionality
 */

import { getActivityFeed } from "@/lib/actions/activity-feed";
import { useQuery } from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";

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
 * Hook to get activity feed items (simplified version without infinite scroll)
 */
export function useActivityFeedItems(festivalId?: string) {
  const query = useActivityFeed(festivalId);

  return {
    ...query,
    activities: query.data?.activities || [],
    hasNextPage: query.data?.hasMore || false,
    fetchNextPage: () => {}, // Placeholder - infinite scroll not implemented yet
    isFetchingNextPage: false,
    totalCount: query.data?.activities?.length || 0,
  };
}
