/**
 * Shared hooks for admin group management
 *
 * Backed by the `/v1/admin/groups` endpoints, which sit behind the requireAdmin
 * middleware. Every write runs on the caller's own token under the
 * "Super admins can do anything" policy on `groups`.
 */

import { QueryKeys, useApiClient, useInvalidateQueries, useMutation, useQuery } from "../data";
import type {
  AdminGroup,
  AdminGroupMember,
  UpdateAdminGroupInput,
  WinningCriterion,
} from "../schemas/admin.schema";

/** Hook to list every group with its member count. */
export function useAdminGroups() {
  const apiClient = useApiClient();

  const query = useQuery<AdminGroup[]>(
    QueryKeys.adminGroups(),
    async () => {
      const response = await apiClient.admin.groups.list();
      return response.groups || [];
    },
    {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  );

  return {
    groups: query.data || [],
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

/** Hook to fetch one group, so the detail view survives a reload or deep link. */
export function useAdminGroup(groupId?: string) {
  const apiClient = useApiClient();

  const query = useQuery<AdminGroup | null>(
    QueryKeys.adminGroup(groupId ?? ""),
    async () => {
      if (!groupId) return null;
      const response = await apiClient.admin.groups.get(groupId);
      return response.group;
    },
    {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      enabled: !!groupId,
    },
  );

  return {
    group: query.data ?? null,
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

/** Hook to list a group's members. */
export function useAdminGroupMembers(groupId?: string) {
  const apiClient = useApiClient();

  const query = useQuery<AdminGroupMember[]>(
    QueryKeys.adminGroupMembers(groupId ?? ""),
    async () => {
      if (!groupId) return [];
      const response = await apiClient.admin.groups.listMembers(groupId);
      return response.members || [];
    },
    {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      enabled: !!groupId,
    },
  );

  return {
    members: query.data || [],
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

/** Hook to update a group's name, description or winning criteria. */
export function useUpdateAdminGroup() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ groupId, data }: { groupId: string; data: UpdateAdminGroupInput }) =>
      apiClient.admin.groups.update(groupId, data),
    {
      onSuccess: (_result, variables) => {
        invalidateQueries(QueryKeys.adminGroups());
        invalidateQueries(QueryKeys.adminGroup(variables.groupId));
      },
    },
  );
}

/** Hook to delete a group. Memberships cascade. */
export function useDeleteAdminGroup() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(async (groupId: string) => apiClient.admin.groups.delete(groupId), {
    onSuccess: () => {
      invalidateQueries(QueryKeys.adminGroups());
    },
  });
}

/**
 * Hook to list the winning criteria a group can be scored by.
 *
 * Long staleTime: this is a small reference table that effectively never
 * changes between deploys.
 */
export function useAdminWinningCriteria() {
  const apiClient = useApiClient();

  const query = useQuery<WinningCriterion[]>(
    QueryKeys.adminWinningCriteria(),
    async () => {
      const response = await apiClient.admin.listWinningCriteria();
      return response.criteria || [];
    },
    {
      staleTime: 60 * 60 * 1000, // 1 hour - reference data
      gcTime: 2 * 60 * 60 * 1000,
    },
  );

  return {
    criteria: query.data || [],
    isLoading: query.loading,
    error: query.error?.message || null,
  };
}
