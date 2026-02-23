/**
 * Shared hooks for group messages
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
 * Hook to fetch messages for a specific group with pagination
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
      await new Promise((resolve) => setTimeout(resolve, 800));
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
      await new Promise((resolve) => setTimeout(resolve, 800));
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
 * Hook to post a new message
 */
export function usePostMessage() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({
      groupId,
      content,
      messageType,
    }: {
      groupId: string;
      content: string;
      messageType?: GroupMessageType;
    }) => {
      return await apiClient.groupMessages.create(groupId, {
        content,
        messageType,
      });
    },
    {
      onSuccess: (_data, variables) => {
        invalidateQueries(["group-messages", variables.groupId]);
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
      groupId,
      messageId,
      updates,
    }: {
      groupId: string;
      messageId: string;
      updates: {
        content?: string;
        messageType?: GroupMessageType;
        pinned?: boolean;
      };
    }) => {
      return await apiClient.groupMessages.update(
        groupId,
        messageId,
        updates,
      );
    },
    {
      onSuccess: (_data, variables) => {
        invalidateQueries(["group-messages", variables.groupId]);
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
    async ({
      groupId,
      messageId,
    }: {
      groupId: string;
      messageId: string;
    }) => {
      return await apiClient.groupMessages.delete(groupId, messageId);
    },
    {
      onSuccess: (_data, variables) => {
        invalidateQueries(["group-messages", variables.groupId]);
        invalidateQueries(["message-feed"]);
      },
    },
  );
}
