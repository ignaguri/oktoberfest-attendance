/**
 * Shared hooks for admin user and attendance management
 *
 * Backed by the `/v1/admin/users` and `/v1/admin/attendances` endpoints, which
 * sit behind the requireAdmin middleware. Errors (including a 403) surface
 * rather than being swallowed into an empty list.
 */

import { QueryKeys, useApiClient, useInvalidateQueries, useMutation, useQuery } from "../data";
import type {
  AdminAttendance,
  AdminUser,
  ListAdminUsersResponse,
  UpdateAdminAttendanceInput,
  UpdateAdminUserAuthInput,
  UpdateAdminUserProfileInput,
} from "../schemas/admin.schema";

const EMPTY_USERS: ListAdminUsersResponse = {
  users: [],
  totalCount: 0,
  totalPages: 0,
  currentPage: 1,
  truncated: false,
};

/**
 * Hook to list users, optionally filtered by email, username or full name.
 *
 * The caller is expected to debounce `search` -- every distinct term is its
 * own cache entry, and each miss walks the auth directory server-side.
 */
export function useAdminUsers(search?: string, page = 1, limit = 50) {
  const apiClient = useApiClient();

  const query = useQuery<ListAdminUsersResponse>(
    QueryKeys.adminUsers(search, page, limit),
    async () => apiClient.admin.users.list({ search, page, limit }),
    {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  );

  const data = query.data ?? EMPTY_USERS;

  return {
    users: data.users,
    totalCount: data.totalCount,
    totalPages: data.totalPages,
    currentPage: data.currentPage,
    /** True when the auth directory was larger than the server's scan ceiling. */
    truncated: data.truncated,
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

/** Hook to fetch one user, so the detail view survives a reload or deep link. */
export function useAdminUser(userId?: string) {
  const apiClient = useApiClient();

  const query = useQuery<AdminUser | null>(
    QueryKeys.adminUser(userId ?? ""),
    async () => {
      if (!userId) return null;
      const response = await apiClient.admin.users.get(userId);
      return response.user;
    },
    {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      enabled: !!userId,
    },
  );

  return {
    user: query.data ?? null,
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

/** Hook to update another user's profile fields, including the admin flag. */
export function useUpdateAdminUserProfile() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ userId, data }: { userId: string; data: UpdateAdminUserProfileInput }) =>
      apiClient.admin.users.updateProfile(userId, data),
    {
      onSuccess: (_result, variables) => {
        invalidateQueries(QueryKeys.adminUsersAll());
        invalidateQueries(QueryKeys.adminUser(variables.userId));
      },
    },
  );
}

/** Hook to change another user's email or password. */
export function useUpdateAdminUserAuth() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ userId, data }: { userId: string; data: UpdateAdminUserAuthInput }) =>
      apiClient.admin.users.updateAuth(userId, data),
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.adminUsersAll());
      },
    },
  );
}

/** Hook to delete a user account. */
export function useDeleteAdminUser() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(async (userId: string) => apiClient.admin.users.delete(userId), {
    onSuccess: () => {
      invalidateQueries(QueryKeys.adminUsersAll());
    },
  });
}

/** Hook to list one user's attendances with the tents visited each day. */
export function useAdminUserAttendances(userId?: string) {
  const apiClient = useApiClient();

  const query = useQuery<AdminAttendance[]>(
    QueryKeys.adminUserAttendances(userId ?? ""),
    async () => {
      if (!userId) return [];
      const response = await apiClient.admin.users.listAttendances(userId);
      return response.attendances || [];
    },
    {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      enabled: !!userId,
    },
  );

  return {
    attendances: query.data || [],
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

/** Hook to update an attendance and, optionally, that day's tent visits. */
export function useUpdateAdminAttendance() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ attendanceId, data }: { attendanceId: string; data: UpdateAdminAttendanceInput }) =>
      apiClient.admin.attendances.update(attendanceId, data),
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.adminUserAttendancesAll());
      },
    },
  );
}

/** Hook to delete an attendance. */
export function useDeleteAdminAttendance() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (attendanceId: string) => apiClient.admin.attendances.delete(attendanceId),
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.adminUserAttendancesAll());
      },
    },
  );
}
