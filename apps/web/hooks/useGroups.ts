/**
 * Business logic hooks for group-related data and operations
 *
 * Migrated to use Hono API client instead of server actions
 */

import { apiClient } from "@/lib/api-client";
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
    async () => {
      if (!festivalId) return [];

      const { data } = await apiClient.groups.list({ festivalId });
      return data;
    },
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
    async () => {
      return await apiClient.groups.get(groupId);
    },
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
 *
 * COMPATIBILITY NOTE: Frontend still uses old schema (groupName/password),
 * but API uses new schema (name/winningCriteria). This adapter bridges the gap temporarily.
 */
export function useCreateGroup() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (formData: {
      groupName: string;
      password: string;
      festivalId: string;
    }) => {
      // Transform old schema to new API schema
      const group = await apiClient.groups.create({
        name: formData.groupName,
        festivalId: formData.festivalId,
        winningCriteria: "total_beers", // Default value since form doesn't provide it
      });

      return group.id; // Return just the ID to match old behavior
    },
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
 *
 * NOTE: API compatibility issue - old implementation used groupName/password,
 * new API uses groupId/inviteToken. Frontend flow needs to be updated to:
 * 1. Find group by name first (not yet implemented in API), OR
 * 2. Use QR code/link that includes groupId
 *
 * For now, keeping this as a placeholder that expects groupId to be known
 */
export function useJoinGroup() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (formData: { groupId: string; inviteToken?: string }) => {
      const { groupId, inviteToken } = formData;
      return await apiClient.groups.join(groupId, inviteToken);
    },
    {
      onSuccess: () => {
        // Invalidate user groups
        invalidateQueries(["user", "current", "groups"]);
        // Invalidate all groups queries
        invalidateQueries(["user"]);
        invalidateQueries(["groups"]);
      },
    },
  );
}

/**
 * Hook to update group settings
 * NOTE: This endpoint is not yet implemented in the API
 * Keeping old implementation for now
 */
export function useUpdateGroup() {
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({
      groupId,
      updates,
    }: {
      groupId: string;
      updates: { name?: string; winningCriteriaId?: number };
    }) => {
      // TODO: Implement PUT /v1/groups/:id endpoint
      throw new Error("Update group endpoint not yet implemented");
    },
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
    async ({ groupId }: { groupId: string; userId: string }) => {
      return await apiClient.groups.leave(groupId);
    },
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
      try {
        const group = await apiClient.groups.get(groupId);
        return group.name || "Unknown Group";
      } catch {
        return "Unknown Group";
      }
    },
    {
      enabled: !!groupId,
      staleTime: 10 * 60 * 1000, // 10 minutes (same as group settings)
      gcTime: 30 * 60 * 1000, // 30 minutes cache
      retry: 2,
    },
  );
}
