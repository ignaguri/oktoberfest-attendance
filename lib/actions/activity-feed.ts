"use server";

import { logger } from "@/lib/logger";
import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";

import type {
  ActivityFeedResponse,
  ActivityFeedItem,
} from "@/hooks/useActivityFeed";

export async function getActivityFeed(
  festivalId: string,
  cursor?: string,
  limit: number = 5,
): Promise<ActivityFeedResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("User not authenticated");
  }

  try {
    // Build query to fetch activity feed with cursor-based pagination
    let query = supabase
      .from("activity_feed")
      .select("*")
      .eq("festival_id", festivalId)
      .order("activity_time", { ascending: false })
      .limit(limit + 1); // Fetch one extra to determine if there's more

    // Add cursor-based filtering if provided
    if (cursor) {
      query = query.lt("activity_time", cursor);
    }

    const { data: activities, error } = await query;

    if (error) {
      reportSupabaseException("getActivityFeed", error, {
        id: user.id,
      });
      throw new Error("Failed to fetch activity feed");
    }

    // Determine if there are more results
    const hasMore = activities.length > limit;
    const resultActivities = hasMore ? activities.slice(0, limit) : activities;

    // Get the next cursor (last item's activity_time)
    const nextCursor =
      hasMore && resultActivities.length > 0
        ? resultActivities[resultActivities.length - 1].activity_time
        : null;

    logger.debug("Fetched activity feed", {
      userId: user.id,
      count: resultActivities.length,
      hasMore,
      cursor,
    });

    return {
      activities: resultActivities as ActivityFeedItem[],
      nextCursor,
      hasMore,
    };
  } catch (error) {
    logger.error("Error fetching activity feed", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: user.id,
      cursor,
    });
    throw error;
  }
}
