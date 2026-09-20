/**
 * Shared hooks for admin location session management
 *
 * Backed by the `/v1/admin/location/*` endpoints, which sit behind the
 * requireAdmin middleware. Callers are expected to have already established
 * that the user is an admin (profile.is_super_admin) -- these hooks surface the
 * server's 403 as an error rather than hiding it, so a UI that renders them to
 * a non-admin will show a failure instead of an empty list.
 */

import { QueryKeys, useApiClient, useInvalidateQueries, useMutation, useQuery } from "../data";
import type { AdminLocationSession } from "../schemas/admin.schema";

interface AdminLocationSessionFilters {
  festivalId?: string;
  userId?: string;
  includeExpired?: boolean;
}

/**
 * Hook to list active location sharing sessions across all users.
 *
 * Polled rather than merely short-lived: sessions expire on a timer of their
 * own, and `staleTime` only marks cached data refetchable, it does not schedule
 * anything. Without the interval a screen left open keeps listing sessions that
 * ended minutes ago.
 */
export function useAdminLocationSessions(filters?: AdminLocationSessionFilters) {
  const apiClient = useApiClient();

  const query = useQuery<AdminLocationSession[]>(
    QueryKeys.adminLocationSessions(filters),
    async () => {
      const response = await apiClient.admin.location.listSessions(filters);
      return response.sessions || [];
    },
    {
      staleTime: 30 * 1000,
      refetchInterval: 30 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  );

  return {
    sessions: query.data || [],
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
    isInitialLoading: query.isInitialLoading,
    isRefetching: query.isRefetching,
  };
}

/**
 * Hook to force-stop a location session regardless of ownership.
 */
export function useForceStopLocationSession() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (sessionId: string) => apiClient.admin.location.forceStopSession(sessionId),
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.adminLocationSessionsAll());
      },
    },
  );
}

/**
 * Hook to mark every expired location session inactive.
 */
export function useCleanupExpiredLocationSessions() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(async () => apiClient.admin.location.cleanupExpiredSessions(), {
    onSuccess: () => {
      invalidateQueries(QueryKeys.adminLocationSessionsAll());
    },
  });
}
