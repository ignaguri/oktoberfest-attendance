/**
 * Unified feed hook that merges activity feed and group messages
 * into a single chronological feed.
 *
 * Extensible: to add new feed types, add a new entry to UnifiedFeedItem
 * and map the source data in this hook.
 */

import { useCallback, useMemo } from "react";

import type { ActivityFeedItem, GroupMessageItem } from "../schemas";

import { useActivityFeedItems } from "./useActivityFeed";
import { useMessageFeed } from "./useGroupMessages";

// --- Discriminated union types ---

type UnifiedFeedItemBase = {
  /** Unique key for React rendering */
  feedItemId: string;
  /** ISO timestamp for chronological sorting */
  timestamp: string;
};

type ActivityFeedEntry = UnifiedFeedItemBase & {
  feedType: "activity";
  data: ActivityFeedItem;
};

type MessageFeedEntry = UnifiedFeedItemBase & {
  feedType: "message";
  data: GroupMessageItem;
};

// Add future feed types here, e.g.:
// type CrowdReportFeedEntry = UnifiedFeedItemBase & { feedType: "crowd_report"; data: ... };

export type UnifiedFeedItem = ActivityFeedEntry | MessageFeedEntry;

// --- Hook ---

export function useUnifiedFeed(festivalId?: string) {
  const activities = useActivityFeedItems(festivalId);
  const messages = useMessageFeed(festivalId);

  // Map activities to unified items
  const activityItems: UnifiedFeedItem[] = useMemo(
    () =>
      activities.activities.map((a, i) => ({
        feedItemId: `activity-${a.user_id}-${a.activity_time}-${i}`,
        feedType: "activity" as const,
        timestamp: a.activity_time,
        data: a,
      })),
    [activities.activities],
  );

  // Map messages to unified items
  const messageItems: UnifiedFeedItem[] = useMemo(
    () =>
      messages.messages.map((m) => ({
        feedItemId: `message-${m.id}`,
        feedType: "message" as const,
        timestamp: m.createdAt,
        data: m,
      })),
    [messages.messages],
  );

  // Merge and sort by timestamp descending (newest first)
  const feedItems = useMemo(
    () =>
      [...activityItems, ...messageItems].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [activityItems, messageItems],
  );

  const hasNextPage = activities.hasNextPage || messages.hasNextPage;
  const isFetchingNextPage =
    activities.isFetchingNextPage || messages.isFetchingNextPage;

  // Load more from whichever source's tail is newer (it has more ground to cover)
  const fetchNextPage = useCallback(() => {
    if (isFetchingNextPage) return;

    const actTail = activityItems[activityItems.length - 1]?.timestamp;
    const msgTail = messageItems[messageItems.length - 1]?.timestamp;

    const actTailTime = actTail ? new Date(actTail).getTime() : undefined;
    const msgTailTime = msgTail ? new Date(msgTail).getTime() : undefined;

    if (activities.hasNextPage && messages.hasNextPage) {
      // Fetch from the source whose oldest item is newer (more to catch up)
      if (
        actTailTime === undefined ||
        (msgTailTime !== undefined && msgTailTime > actTailTime)
      ) {
        messages.fetchNextPage();
      } else {
        activities.fetchNextPage();
      }
    } else if (activities.hasNextPage) {
      activities.fetchNextPage();
    } else if (messages.hasNextPage) {
      messages.fetchNextPage();
    }
  }, [
    isFetchingNextPage,
    activities.hasNextPage,
    messages.hasNextPage,
    activities.fetchNextPage,
    messages.fetchNextPage,
    activityItems,
    messageItems,
  ]);

  const loading =
    (activities.loading || messages.loading) &&
    activityItems.length === 0 &&
    messageItems.length === 0;
  const isRefreshing = activities.isRefreshing || messages.isRefreshing;
  const error = activities.error || messages.error;

  const refresh = useCallback(async () => {
    await Promise.all([activities.refresh(), messages.refresh()]);
  }, [activities.refresh, messages.refresh]);

  return {
    feedItems,
    loading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isRefreshing,
    refresh,
    error,
  };
}
