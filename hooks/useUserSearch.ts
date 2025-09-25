"use client";

import { getUsers, getUserAttendances } from "@/app/(private)/admin/actions";
import {
  searchKeys,
  type UserSearchFilters,
} from "@/lib/data/search-query-keys";
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import type { Tables } from "@/lib/database.types";
import type { User } from "@supabase/supabase-js";

// Import the server actions

export type CombinedUser = User & { profile: Tables<"profiles"> };

export interface UserSearchResult {
  users: CombinedUser[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface UserAttendancesResult {
  attendances: Tables<"attendances">[];
  totalCount: number;
}

/**
 * Hook for searching users with pagination
 */
export function useUserSearch(filters: UserSearchFilters = {}) {
  const {
    search = "",
    page = 1,
    limit = 50,
    sortBy: _sortBy = "created_at",
    sortOrder: _sortOrder = "desc",
    ...otherFilters
  } = filters;

  return useQuery({
    queryKey: searchKeys.users(filters),
    queryFn: async (): Promise<UserSearchResult> => {
      const result = await getUsers(search, page, limit);
      return {
        users: result.users as CombinedUser[],
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: true,
  });
}

/**
 * Hook for infinite user search (for infinite scroll)
 */
export function useInfiniteUserSearch(
  filters: Omit<UserSearchFilters, "page"> = {},
) {
  const { limit = 50, ...otherFilters } = filters;

  return useInfiniteQuery({
    queryKey: searchKeys.users({ ...filters, page: undefined }),
    queryFn: async ({ pageParam = 1 }): Promise<UserSearchResult> => {
      const result = await getUsers(
        filters.search || "",
        pageParam as number,
        limit,
      );
      return {
        users: result.users as CombinedUser[],
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
      };
    },
    getNextPageParam: (lastPage: UserSearchResult) => {
      return lastPage.currentPage < lastPage.totalPages
        ? lastPage.currentPage + 1
        : undefined;
    },
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook for getting user attendances
 */
export function useUserAttendances(
  userId: string,
  filters: { search?: string; page?: number; limit?: number } = {},
) {
  return useQuery({
    queryKey: searchKeys.userAttendances(userId, filters),
    queryFn: async (): Promise<UserAttendancesResult> => {
      const attendances = await getUserAttendances(userId);
      return {
        attendances,
        totalCount: attendances.length,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!userId,
  });
}

/**
 * Hook for user search mutations (create, update, delete)
 */
export function useUserSearchMutations() {
  const queryClient = useQueryClient();

  const invalidateUserQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: searchKeys.all });
  }, [queryClient]);

  const prefetchUserSearch = useCallback(
    (filters: UserSearchFilters) => {
      queryClient.prefetchQuery({
        queryKey: searchKeys.users(filters),
        queryFn: async () => {
          const result = await getUsers(
            filters.search || "",
            filters.page || 1,
            filters.limit || 50,
          );
          return {
            users: result.users as CombinedUser[],
            totalCount: result.totalCount,
            totalPages: result.totalPages,
            currentPage: result.currentPage,
          };
        },
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient],
  );

  return {
    invalidateUserQueries,
    prefetchUserSearch,
  };
}

/**
 * Hook for optimistic user updates
 */
export function useOptimisticUserUpdate() {
  const queryClient = useQueryClient();

  const updateUserInCache = useCallback(
    (userId: string, updates: Partial<CombinedUser>) => {
      queryClient.setQueriesData(
        { queryKey: searchKeys.all },
        (oldData: any) => {
          if (!oldData) return oldData;

          if (Array.isArray(oldData)) {
            return oldData.map((user: CombinedUser) =>
              user.id === userId ? { ...user, ...updates } : user,
            );
          }

          if (oldData?.users) {
            return {
              ...oldData,
              users: oldData.users.map((user: CombinedUser) =>
                user.id === userId ? { ...user, ...updates } : user,
              ),
            };
          }

          return oldData;
        },
      );
    },
    [queryClient],
  );

  return { updateUserInCache };
}
