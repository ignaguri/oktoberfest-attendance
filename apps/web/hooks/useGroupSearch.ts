"use client";

import type { Tables } from "@prostcounter/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  deleteGroup,
  getGroups,
  updateGroup,
} from "@/app/(private)/admin/actions";
import {
  type GroupSearchFilters,
  searchKeys,
} from "@/lib/data/search-query-keys";

// Import the server actions

export type Group = Tables<"groups">;

export interface GroupSearchResult {
  groups: Group[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

/**
 * Hook for searching groups with pagination
 */
export function useGroupSearch(filters: GroupSearchFilters = {}) {
  const {
    search = "",
    page = 1,
    limit = 50,
    sortBy = "created_at",
    sortOrder = "desc",
    ...otherFilters
  } = filters;

  return useQuery({
    queryKey: searchKeys.groups(filters),
    queryFn: async (): Promise<GroupSearchResult> => {
      const groups = await getGroups();

      // Client-side filtering is appropriate here since:
      // 1. Admin-only feature with limited user access
      // 2. Total group count is manageable (< 1000)
      // 3. Server action already caches the full list
      let filteredGroups = groups;

      if (search) {
        filteredGroups = groups.filter(
          (group) =>
            group.name.toLowerCase().includes(search.toLowerCase()) ||
            (group.description &&
              group.description.toLowerCase().includes(search.toLowerCase())),
        );
      }

      // Sort
      filteredGroups.sort((a, b) => {
        const aValue = a[sortBy as keyof Group];
        const bValue = b[sortBy as keyof Group];

        if (aValue == null || bValue == null) return 0;
        if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });

      const totalCount = filteredGroups.length;
      const totalPages = Math.ceil(totalCount / limit);

      // Paginate
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedGroups = filteredGroups.slice(startIndex, endIndex);

      return {
        groups: paginatedGroups,
        totalCount,
        totalPages,
        currentPage: page,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: true,
  });
}

/**
 * Hook for group search mutations (create, update, delete)
 */
export function useGroupSearchMutations() {
  const queryClient = useQueryClient();

  const invalidateGroupQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: searchKeys.all });
  }, [queryClient]);

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Group> }) => {
      return updateGroup(id, data);
    },
    onSuccess: () => {
      invalidateGroupQueries();
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      return deleteGroup(id);
    },
    onSuccess: () => {
      invalidateGroupQueries();
    },
  });

  return {
    invalidateGroupQueries,
    updateGroup: updateGroupMutation.mutateAsync,
    deleteGroup: deleteGroupMutation.mutateAsync,
    isUpdating: updateGroupMutation.isPending,
    isDeleting: deleteGroupMutation.isPending,
  };
}

/**
 * Hook for optimistic group updates
 */
export function useOptimisticGroupUpdate() {
  const queryClient = useQueryClient();

  const updateGroupInCache = useCallback(
    (groupId: string, updates: Partial<Group>) => {
      queryClient.setQueriesData(
        { queryKey: searchKeys.all },
        (oldData: any) => {
          if (!oldData) return oldData;

          if (Array.isArray(oldData)) {
            return oldData.map((group: Group) =>
              group.id === groupId ? { ...group, ...updates } : group,
            );
          }

          if (oldData?.groups) {
            return {
              ...oldData,
              groups: oldData.groups.map((group: Group) =>
                group.id === groupId ? { ...group, ...updates } : group,
              ),
            };
          }

          return oldData;
        },
      );
    },
    [queryClient],
  );

  return { updateGroupInCache };
}
