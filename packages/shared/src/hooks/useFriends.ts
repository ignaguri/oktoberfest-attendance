/**
 * Shared hooks for friend-related data and operations
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import { useApiClient, useQuery, useMutation, useInvalidateQueries, QueryKeys } from "../data";

/**
 * Hook to fetch accepted friends list
 */
export function useFriends() {
  const apiClient = useApiClient();

  return useQuery(QueryKeys.friends(), async () => {
    const { data } = await apiClient.friends.list();
    return data;
  });
}

/**
 * Hook to fetch incoming friend requests
 */
export function useFriendRequests() {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.friendRequestsIncoming(),
    async () => {
      const { data } = await apiClient.friends.getIncomingRequests();
      return data;
    },
    {
      refetchOnWindowFocus: true,
    },
  );
}

/**
 * Hook to fetch outgoing friend requests
 */
export function useOutgoingFriendRequests() {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.friendRequestsOutgoing(),
    async () => {
      const { data } = await apiClient.friends.getOutgoingRequests();
      return data;
    },
    {
      refetchOnWindowFocus: true,
    },
  );
}

/**
 * Hook to fetch count of pending incoming requests (for badge)
 */
export function useFriendRequestCount() {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.friendRequestCount(),
    async () => {
      const { count } = await apiClient.friends.getRequestCount();
      return count;
    },
    {
      staleTime: 30 * 1000, // 30 seconds - refresh often for badge accuracy
      refetchOnWindowFocus: true,
    },
  );
}

/**
 * Hook to send a friend request
 */
export function useSendFriendRequest() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (addresseeId: string) => {
      return await apiClient.friends.sendRequest(addresseeId);
    },
    {
      onSuccess: (_data, addresseeId) => {
        invalidateQueries(QueryKeys.friendRequestsOutgoing());
        invalidateQueries(QueryKeys.friendSuggestions());
        invalidateQueries(QueryKeys.friendshipStatus(addresseeId));
        // Cached search results carry their own friendshipStatus, and the
        // Add Friend button renders off it. Without this the button falls
        // straight back to "Add friend" once the mutation settles.
        invalidateQueries(QueryKeys.friendSearchAll());
        invalidateQueries(["public-profile", addresseeId] as const);
      },
    },
  );
}

/**
 * Hook to accept a friend request
 */
export function useAcceptFriendRequest() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (friendshipId: string) => {
      return await apiClient.friends.acceptRequest(friendshipId);
    },
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.friends());
        invalidateQueries(QueryKeys.friendRequestsIncoming());
        invalidateQueries(QueryKeys.friendRequestCount());
        invalidateQueries(QueryKeys.friendSuggestions());
        invalidateQueries(["public-profile"] as const);
        invalidateQueries(QueryKeys.pendingUnlocks());
      },
    },
  );
}

/**
 * Hook to decline a friend request
 */
export function useDeclineFriendRequest() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (friendshipId: string) => {
      return await apiClient.friends.declineRequest(friendshipId);
    },
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.friendRequestsIncoming());
        invalidateQueries(QueryKeys.friendRequestCount());
        invalidateQueries(QueryKeys.friendSearchAll());
        invalidateQueries(QueryKeys.friendshipStatusAll());
      },
    },
  );
}

/**
 * Hook to cancel an outgoing friend request
 */
export function useCancelFriendRequest() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (friendshipId: string) => {
      return await apiClient.friends.cancelRequest(friendshipId);
    },
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.friendRequestsOutgoing());
        invalidateQueries(QueryKeys.friendSuggestions());
        invalidateQueries(QueryKeys.friendSearchAll());
        // The mutation only knows the friendship id, so the cached status for
        // the other user has to go by prefix. Left stale it still reads
        // pending_sent with a friendship id the server has already deleted.
        invalidateQueries(QueryKeys.friendshipStatusAll());
      },
    },
  );
}

/**
 * Hook to unfriend a user
 */
export function useUnfriend() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (userId: string) => {
      return await apiClient.friends.unfriend(userId);
    },
    {
      onSuccess: (_data, userId) => {
        invalidateQueries(QueryKeys.friends());
        invalidateQueries(QueryKeys.friendSuggestions());
        invalidateQueries(QueryKeys.friendshipStatus(userId));
      },
    },
  );
}

/**
 * Hook to fetch friend suggestions (people you may know)
 */
export function useFriendSuggestions() {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.friendSuggestions(),
    async () => {
      const { data } = await apiClient.friends.getSuggestions();
      return data;
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  );
}

/**
 * Hook to search users by username or name
 */
export function useSearchUsers(query: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.friendSearch(query),
    async () => {
      const { data } = await apiClient.friends.search(query);
      return data;
    },
    {
      enabled: query.length >= 1,
      staleTime: 30 * 1000, // 30 seconds
    },
  );
}

/**
 * Hook to check friendship status with a specific user
 */
export function useFriendshipStatus(userId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.friendshipStatus(userId || ""),
    async () => {
      if (!userId) return { status: "none" as const, friendshipId: null };
      return await apiClient.friends.getStatus(userId);
    },
    {
      enabled: !!userId,
    },
  );
}
