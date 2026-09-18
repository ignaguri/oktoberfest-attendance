/**
 * Shared hooks for requesting to join a group and answering requests
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import { QueryKeys, useApiClient, useInvalidateQueries, useMutation, useQuery } from "../data";

/**
 * Pending join requests on groups the current user created
 *
 * @param enabled - pass false for users who created no group to skip the request
 */
export function useIncomingJoinRequests(enabled = true) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.groupJoinRequestsIncoming(),
    async () => {
      const { data } = await apiClient.groups.getIncomingJoinRequests();
      return data;
    },
    {
      enabled,
      refetchOnWindowFocus: true,
    },
  );
}

/**
 * Ask to join a group found by search
 */
export function useRequestToJoinGroup() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (groupId: string) => {
      return await apiClient.groups.requestToJoin(groupId);
    },
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.groupSearchAll());
      },
    },
  );
}

/**
 * Withdraw your own pending request
 */
export function useCancelJoinRequest() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (groupId: string) => {
      return await apiClient.groups.cancelJoinRequest(groupId);
    },
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.groupSearchAll());
      },
    },
  );
}

/**
 * Accept a request as the group's creator
 */
export function useAcceptJoinRequest() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (requestId: string) => {
      return await apiClient.groups.acceptJoinRequest(requestId);
    },
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.groupJoinRequestsIncoming());
        // Member lists and counts of the group changed
        invalidateQueries(["group"]);
        invalidateQueries(["groups"]);
        // A new member changes the group leaderboard and the member counts in the groups list
        invalidateQueries(["leaderboard", "group"]);
        invalidateQueries(["user", "current", "groups"]);
      },
    },
  );
}

/**
 * Decline a request as the group's creator (the requester is not told)
 */
export function useDeclineJoinRequest() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (requestId: string) => {
      return await apiClient.groups.declineJoinRequest(requestId);
    },
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.groupJoinRequestsIncoming());
      },
    },
  );
}
