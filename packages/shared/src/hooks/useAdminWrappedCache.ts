/**
 * Shared hooks for the Wrapped data cache admin surface.
 *
 * Reads go through `/v1/admin/wrapped-cache` behind the requireAdmin
 * middleware; the regeneration write is the older `/v1/wrapped/regenerate`,
 * which predates the admin namespace and carries its own super-admin check
 * inside the `regenerate_wrapped_data_cache` function.
 */

import { QueryKeys, useApiClient, useInvalidateQueries, useMutation, useQuery } from "../data";
import type { AdminWrappedCacheEntry } from "../schemas/admin.schema";

/** Hook to list every cached Wrapped entry, most recently regenerated first. */
export function useAdminWrappedCache() {
  const apiClient = useApiClient();

  const query = useQuery<AdminWrappedCacheEntry[]>(
    QueryKeys.adminWrappedCache(),
    async () => {
      const response = await apiClient.admin.wrappedCache.list();
      return response.entries || [];
    },
    {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  );

  return {
    entries: query.data || [],
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

/**
 * Hook to regenerate cached Wrapped data.
 *
 * Both filters are optional and narrow the same statement: omit them and every
 * cached entry is recalculated. Note the database function only *updates* rows
 * that already exist, so this cannot create a Wrapped for someone who has
 * never opened theirs.
 */
export function useRegenerateWrappedCache() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (filters: { festivalId?: string; userId?: string } = {}) =>
      apiClient.wrapped.regenerateCache(filters),
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.adminWrappedCache());
        // The payload these entries hold is what the Wrapped screens read, and
        // this device may be showing a copy of one that just changed.
        invalidateQueries(QueryKeys.wrappedAll());
      },
    },
  );
}
