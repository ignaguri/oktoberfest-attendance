/**
 * Business logic hooks for group-related data and operations
 *
 * These hooks handle all group management functionality
 */

import {
  fetchGroupDetailsSafe,
  updateGroup,
  removeMember,
} from "@/app/(private)/group-settings/[id]/actions";
import {
  createGroup,
  joinGroup,
  fetchUserGroups,
} from "@/app/(private)/groups/actions";
import {
  useQuery,
  useMutation,
  useInvalidateQueries,
} from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";

/**
 * Hook to fetch user's groups for a festival
 */
export function useUserGroups(festivalId?: string) {
  return useQuery(
    QueryKeys.userGroups("current", festivalId || ""),
    () => fetchUserGroups(festivalId!),
    {
      enabled: !!festivalId,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes cache
    },
  );
}

/**
 * Hook to fetch group settings/details
 */
export function useGroupSettings(groupId: string) {
  return useQuery(
    QueryKeys.group(groupId),
    () => fetchGroupDetailsSafe(groupId),
    {
      enabled: !!groupId,
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes cache
      retry: 2,
    },
  );
}

/**
 * Hook to create a new group with cache invalidation
 */
export function useCreateGroup() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    (groupData: Parameters<typeof createGroup>[0]) => createGroup(groupData),
    {
      onSuccess: (data, variables) => {
        // Invalidate user groups for the specific festival
        invalidateQueries(["user", "current", "groups"]);
        // Invalidate groups for the specific festival
        if (variables.festivalId) {
          invalidateQueries(["groups", variables.festivalId]);
        }
        // Also invalidate general user and groups queries
        invalidateQueries(["user"]);
        invalidateQueries(["groups"]);
      },
    },
  );
}

/**
 * Hook to join a group by invite token
 */
export function useJoinGroup() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    (formData: Parameters<typeof joinGroup>[0]) => joinGroup(formData),
    {
      onSuccess: (data, variables) => {
        // Invalidate user groups for the specific festival
        invalidateQueries(["user", "current", "groups"]);
        // Invalidate groups for the specific festival
        if (variables.festivalId) {
          invalidateQueries(["groups", variables.festivalId]);
        }
        // Also invalidate general user and groups queries
        invalidateQueries(["user"]);
        invalidateQueries(["groups"]);
      },
    },
  );
}

/**
 * Hook to update group settings
 */
export function useUpdateGroup() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    ({
      groupId,
      updates,
    }: {
      groupId: string;
      updates: Parameters<typeof updateGroup>[1];
    }) => updateGroup(groupId, updates),
    {
      onSuccess: (data, { groupId }) => {
        // Invalidate specific group
        invalidateQueries(["group", groupId]);
        // Invalidate user groups
        invalidateQueries(["user", "current", "groups"]);
        // Invalidate all groups and user queries as fallback
        invalidateQueries(["user"]);
        invalidateQueries(["groups"]);
      },
    },
  );
}

/**
 * Hook to leave a group
 */
export function useLeaveGroup() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    ({ groupId, userId }: { groupId: string; userId: string }) =>
      removeMember(groupId, userId),
    {
      onSuccess: (data, { groupId }) => {
        // Invalidate specific group and its members
        invalidateQueries(["group", groupId]);
        invalidateQueries(["group", groupId, "members"]);
        // Invalidate user groups
        invalidateQueries(["user", "current", "groups"]);
        // Invalidate all groups and user queries as fallback
        invalidateQueries(["user"]);
        invalidateQueries(["groups"]);
      },
    },
  );
}

/**
 * Hook to fetch just the group name (lightweight version of useGroupSettings)
 * Useful for breadcrumbs and other components that only need the group name
 */
export function useGroupName(groupId: string) {
  return useQuery(
    QueryKeys.group(groupId),
    async () => {
      const group = await fetchGroupDetailsSafe(groupId);
      return group?.name || "Unknown Group";
    },
    {
      enabled: !!groupId,
      staleTime: 10 * 60 * 1000, // 10 minutes (same as group settings)
      gcTime: 30 * 60 * 1000, // 30 minutes cache
      retry: 2,
    },
  );
}
