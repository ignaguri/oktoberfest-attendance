/**
 * Shared hooks for inviting people into a group and answering invitations
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import { QueryKeys, useApiClient, useInvalidateQueries, useMutation, useQuery } from "../data";

/**
 * Pending invitations addressed to the current user
 *
 * @param enabled - pass false to skip the request
 */
export function useIncomingGroupInvitations(enabled = true) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.groupInvitationsIncoming(),
    async () => {
      const { data } = await apiClient.groups.getIncomingInvitations();
      return data;
    },
    {
      enabled,
      refetchOnWindowFocus: true,
    },
  );
}

/**
 * Pending invitations the creator sent for one group
 */
export function useSentGroupInvitations(groupId: string, enabled = true) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.groupInvitationsSent(groupId),
    async () => {
      const { data } = await apiClient.groups.getSentInvitations(groupId);
      return data;
    },
    {
      enabled: enabled && groupId.length > 0,
    },
  );
}

/**
 * People the creator could invite, each with where they stand with this group
 */
export function useInvitableUsers(groupId: string, query: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.invitableUsers(groupId, query),
    async () => {
      const { data } = await apiClient.groups.getInvitableUsers(groupId, query);
      return data;
    },
    {
      enabled: groupId.length > 0 && query.length >= 1,
      staleTime: 30 * 1000, // 30 seconds
    },
  );
}

/**
 * Invite someone into a group you created
 */
export function useInviteToGroup(groupId: string) {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (inviteeId: string) => {
      return await apiClient.groups.inviteToGroup(groupId, inviteeId);
    },
    {
      onSuccess: () => {
        // Cached search rows carry their own invitationStatus, and the row's
        // button renders off it. Without this the button falls straight back to
        // "Invite" once the mutation settles.
        invalidateQueries(QueryKeys.invitableUsersAll(groupId));
        invalidateQueries(QueryKeys.groupInvitationsSent(groupId));
      },
      onError: () => {
        // A 409 (already pending, already a member, a join request pending)
        // means the cached row's invitationStatus is already stale. Without
        // this the button keeps showing "Invite" and every retry 409s again.
        invalidateQueries(QueryKeys.invitableUsersAll(groupId));
      },
    },
  );
}

/**
 * Accept an invitation addressed to you (this makes you a group member)
 */
export function useAcceptGroupInvitation() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (invitationId: string) => {
      return await apiClient.groups.acceptGroupInvitation(invitationId);
    },
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.groupInvitationsIncoming());
        // A new membership changes far more than the invitation list
        invalidateQueries(["user", "current", "groups"]);
        invalidateQueries(["user"]);
        invalidateQueries(["groups"]);
        invalidateQueries(["group"]);
        invalidateQueries(["leaderboard", "group"]);
        invalidateQueries(["activity-feed"]);
        invalidateQueries(QueryKeys.pendingUnlocks());
      },
    },
  );
}

/**
 * Decline an invitation addressed to you (the creator is not told)
 */
export function useDeclineGroupInvitation() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (invitationId: string) => {
      return await apiClient.groups.declineGroupInvitation(invitationId);
    },
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.groupInvitationsIncoming());
      },
    },
  );
}

/**
 * Withdraw an invitation you sent
 */
export function useCancelGroupInvitation(groupId: string) {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (invitationId: string) => {
      return await apiClient.groups.cancelGroupInvitation(invitationId);
    },
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.invitableUsersAll(groupId));
        invalidateQueries(QueryKeys.groupInvitationsSent(groupId));
      },
      onError: () => {
        // A stale row (e.g. the invitee already answered) still shows a
        // "Withdraw" button that would just 409 again without this.
        invalidateQueries(QueryKeys.invitableUsersAll(groupId));
        invalidateQueries(QueryKeys.groupInvitationsSent(groupId));
      },
    },
  );
}
