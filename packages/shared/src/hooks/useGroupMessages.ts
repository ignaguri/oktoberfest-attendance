/**
 * Shared hooks for group messages
 *
 * Messages are no longer scoped to a single group. They belong to a user + festival
 * and are visible to all groups the user is a member of.
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import { useState, useCallback, useEffect } from "react";

import {
  useApiClient,
  useQuery,
  useMutation,
  useInvalidateQueries,
  QueryKeys,
} from "../data";

import type {
  GetGroupMessagesResponse,
  GetMessageFeedResponse,
  GroupMessageItem,
  GroupMessageFeedItem,
  GroupMessageType,
} from "../schemas";

/**
 * Hook to fetch messages for a specific group with pagination.
 * Returns messages from all members of the group (not just messages posted to the group).
 */
export function useGroupMessages(groupId: string) {
  const apiClient = useApiClient();
  const [allMessages, setAllMessages] = useState<GroupMessageItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasLoadedMore, setHasLoadedMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const query = useQuery<GetGroupMessagesResponse>(
    [...QueryKeys.groupMessages(groupId), cursor || "initial"],
    () =>
      apiClient.groupMessages.list(groupId, {
        cursor: cursor || undefined,
      }),
    {
      enabled: !!groupId,
      staleTime: 15 * 1000, // 15 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes cache
      refetchOnWindowFocus: true,
    },
  );

  const data = query.data as GetGroupMessagesResponse | null;

  // Update messages when new data arrives
  useEffect(() => {
    if (data?.messages) {
      if (cursor === null || isRefreshing) {
        setAllMessages(data.messages);
      } else {
        setAllMessages((prev) => [...prev, ...data.messages]);
      }
    }
  }, [data?.messages, cursor, isRefreshing]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchNextPage = useCallback(() => {
    if (data?.hasMore && data?.nextCursor && !query.loading) {
      setCursor(data.nextCursor);
      setHasLoadedMore(true);
    }
  }, [data?.hasMore, data?.nextCursor, query.loading]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setCursor(null);
      setHasLoadedMore(false);
      await query.refetch();
    } catch {
      setCursor(null);
      setHasLoadedMore(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [query]);

  return {
    ...query,
    messages: allMessages,
    hasNextPage: data?.hasMore || false,
    fetchNextPage,
    isFetchingNextPage: hasLoadedMore && query.loading,
    isRefreshing,
    refresh,
  };
}

/**
 * Hook to fetch message feed across all user's groups (for home page)
 */
export function useMessageFeed(festivalId?: string) {
  const apiClient = useApiClient();
  const [allMessages, setAllMessages] = useState<GroupMessageFeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasLoadedMore, setHasLoadedMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const query = useQuery<GetMessageFeedResponse>(
    [...QueryKeys.messageFeed(festivalId || ""), cursor || "initial"],
    () =>
      apiClient.groupMessages.feed({
        festivalId: festivalId!,
        cursor: cursor || undefined,
      }),
    {
      enabled: !!festivalId,
      staleTime: 15 * 1000, // 15 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes cache
      refetchOnWindowFocus: true,
    },
  );

  const data = query.data as GetMessageFeedResponse | null;

  // Update messages when new data arrives
  useEffect(() => {
    if (data?.messages) {
      if (cursor === null || isRefreshing) {
        setAllMessages(data.messages);
      } else {
        setAllMessages((prev) => [...prev, ...data.messages]);
      }
    }
  }, [data?.messages, cursor, isRefreshing]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchNextPage = useCallback(() => {
    if (data?.hasMore && data?.nextCursor && !query.loading) {
      setCursor(data.nextCursor);
      setHasLoadedMore(true);
    }
  }, [data?.hasMore, data?.nextCursor, query.loading]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setCursor(null);
      setHasLoadedMore(false);
      await query.refetch();
    } catch {
      setCursor(null);
      setHasLoadedMore(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [query]);

  return {
    ...query,
    messages: allMessages,
    hasNextPage: data?.hasMore || false,
    fetchNextPage,
    isFetchingNextPage: hasLoadedMore && query.loading,
    isRefreshing,
    refresh,
  };
}

/**
 * Hook to post a new message (visible to all user's groups in the festival)
 */
export function usePostMessage() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({
      content,
      messageType,
      festivalId,
    }: {
      content: string;
      messageType?: GroupMessageType;
      festivalId: string;
    }) => {
      return await apiClient.groupMessages.create({
        content,
        messageType,
        festivalId,
      });
    },
    {
      onSuccess: () => {
        // Invalidate all group message caches since the message is visible everywhere
        invalidateQueries(["group-messages"]);
        invalidateQueries(["message-feed"]);
      },
    },
  );
}

/**
 * Hook to update a message
 */
export function useUpdateMessage() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({
      messageId,
      updates,
    }: {
      messageId: string;
      updates: {
        content?: string;
        messageType?: GroupMessageType;
        pinned?: boolean;
      };
    }) => {
      return await apiClient.groupMessages.update(messageId, updates);
    },
    {
      onSuccess: () => {
        invalidateQueries(["group-messages"]);
        invalidateQueries(["message-feed"]);
      },
    },
  );
}

/**
 * Hook to delete a message
 */
export function useDeleteMessage() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ messageId }: { messageId: string }) => {
      return await apiClient.groupMessages.delete(messageId);
    },
    {
      onSuccess: () => {
        invalidateQueries(["group-messages"]);
        invalidateQueries(["message-feed"]);
      },
    },
  );
}
