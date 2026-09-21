/**
 * Shared hooks for admin festival management
 *
 * Backed by the `/v1/admin/festivals` endpoints, behind the requireAdmin
 * middleware. Pure RLS: the "Super admins can manage festivals" policy
 * authorizes every write on the caller's own token.
 */

import { QueryKeys, useApiClient, useInvalidateQueries, useMutation, useQuery } from "../data";
import type {
  AdminFestival,
  CreateAdminFestivalInput,
  UpdateAdminFestivalInput,
} from "../schemas/admin.schema";

/**
 * Hook to list every festival, newest first.
 *
 * Pass `enabled` false to keep the query off until it is needed: a sheet that
 * is mounted but closed would otherwise fetch the whole list on the host
 * screen's first load, the same way useAdminAvailableTents is gated.
 */
export function useAdminFestivals(enabled = true) {
  const apiClient = useApiClient();

  const query = useQuery<AdminFestival[]>(
    QueryKeys.adminFestivals(),
    async () => {
      const response = await apiClient.admin.festivals.list();
      return response.festivals || [];
    },
    {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      enabled,
    },
  );

  return {
    festivals: query.data || [],
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

/** Hook to fetch one festival, so the detail view survives a reload. */
export function useAdminFestival(festivalId?: string) {
  const apiClient = useApiClient();

  const query = useQuery<AdminFestival | null>(
    QueryKeys.adminFestival(festivalId ?? ""),
    async () => {
      if (!festivalId) return null;
      const response = await apiClient.admin.festivals.get(festivalId);
      return response.festival;
    },
    {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      enabled: !!festivalId,
    },
  );

  return {
    festival: query.data ?? null,
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

/** Hook to create a festival. */
export function useCreateAdminFestival() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async (data: CreateAdminFestivalInput) => apiClient.admin.festivals.create(data),
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.adminFestivals());
      },
    },
  );
}

/**
 * Hook to update a festival.
 *
 * Activating one deactivates the others server-side, so the whole list is
 * invalidated rather than just the edited row.
 */
export function useUpdateAdminFestival() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ festivalId, data }: { festivalId: string; data: UpdateAdminFestivalInput }) =>
      apiClient.admin.festivals.update(festivalId, data),
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.adminFestivals());
        // The whole detail prefix, not just the edited row: activating this
        // festival cleared is_active on another one, whose cached detail would
        // otherwise keep its Active badge until it went stale.
        invalidateQueries(QueryKeys.adminFestivalAll());
      },
    },
  );
}

/**
 * Hook to delete a festival.
 *
 * Rejects with the server's message when attendances or groups still reference
 * it; callers should surface that text rather than a generic failure.
 */
export function useDeleteAdminFestival() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(async (festivalId: string) => apiClient.admin.festivals.delete(festivalId), {
    onSuccess: () => {
      invalidateQueries(QueryKeys.adminFestivals());
    },
  });
}
