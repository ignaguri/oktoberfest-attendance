/**
 * Shared hooks for admin tent management
 *
 * Backed by the `/v1/admin/tents` and `/v1/admin/festivals/{id}/tents`
 * endpoints, behind the requireAdmin middleware.
 *
 * The split mirrors the schema: `tents` is a global catalogue, `festival_tents`
 * is what one festival serves and at what price. Editing a catalogue tent
 * changes it everywhere, so those mutations invalidate every festival's list.
 */

import { QueryKeys, useApiClient, useInvalidateQueries, useMutation, useQuery } from "../data";
import type {
  AddAdminFestivalTentInput,
  AddAllAdminFestivalTentsInput,
  AdminFestivalTent,
  AdminFestivalTentStats,
  AdminTent,
  CopyAdminFestivalTentsInput,
  CreateAdminTentInput,
  UpdateAdminTentInput,
} from "../schemas/admin.schema";

/** Hook to list the global tent catalogue, by name. */
export function useAdminTents() {
  const apiClient = useApiClient();

  const query = useQuery<AdminTent[]>(
    QueryKeys.adminTents(),
    async () => {
      const response = await apiClient.admin.tents.list();
      return response.tents || [];
    },
    {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  );

  return {
    tents: query.data || [],
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

/** Hook to list one festival's tents alongside its counts. */
export function useAdminFestivalTents(festivalId?: string) {
  const apiClient = useApiClient();

  const query = useQuery<{ tents: AdminFestivalTent[]; stats: AdminFestivalTentStats } | null>(
    QueryKeys.adminFestivalTents(festivalId ?? ""),
    async () => {
      if (!festivalId) return null;
      return apiClient.admin.tents.forFestival(festivalId);
    },
    {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      enabled: !!festivalId,
    },
  );

  return {
    tents: query.data?.tents ?? [],
    stats: query.data?.stats ?? null,
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

/**
 * Hook to list catalogue tents this festival does not serve yet.
 *
 * Only fetched when a picker is actually open -- pass `enabled` false to keep
 * it off the detail screen's initial load.
 */
export function useAdminAvailableTents(festivalId?: string, enabled = true) {
  const apiClient = useApiClient();

  const query = useQuery<AdminTent[]>(
    QueryKeys.adminFestivalTentsAvailable(festivalId ?? ""),
    async () => {
      if (!festivalId) return [];
      const response = await apiClient.admin.tents.availableFor(festivalId);
      return response.tents || [];
    },
    {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      enabled: !!festivalId && enabled,
    },
  );

  return {
    tents: query.data || [],
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

/** Hook to create a catalogue tent. */
export function useCreateAdminTent() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(async (data: CreateAdminTentInput) => apiClient.admin.tents.create(data), {
    onSuccess: () => {
      invalidateQueries(QueryKeys.adminTents());
      // A new catalogue tent is available to every festival, so the pickers
      // have to refetch. Without this the tent is missing from them until
      // their own staleTime expires.
      invalidateQueries(QueryKeys.adminFestivalAll());
    },
  });
}

/**
 * Hook to rename or recategorise a catalogue tent.
 *
 * The change lands in every festival serving it, so the per-festival lists are
 * invalidated too.
 */
export function useUpdateAdminTent() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ tentId, data }: { tentId: string; data: UpdateAdminTentInput }) =>
      apiClient.admin.tents.update(tentId, data),
    {
      onSuccess: () => {
        invalidateQueries(QueryKeys.adminTents());
        // Every festival's list and picker, via the shared prefix rather than
        // a literal copy of it.
        invalidateQueries(QueryKeys.adminFestivalAll());
      },
    },
  );
}

/** Hook to add one catalogue tent to a festival. */
export function useAddAdminFestivalTent() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ festivalId, data }: { festivalId: string; data: AddAdminFestivalTentInput }) =>
      apiClient.admin.tents.addToFestival(festivalId, data),
    {
      onSuccess: (_result, variables) => {
        invalidateQueries(QueryKeys.adminFestivalTents(variables.festivalId));
        invalidateQueries(QueryKeys.adminFestivalTentsAvailable(variables.festivalId));
      },
    },
  );
}

/** Hook to add every remaining catalogue tent to a festival at one price. */
export function useAddAllAdminFestivalTents() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ festivalId, data }: { festivalId: string; data: AddAllAdminFestivalTentsInput }) =>
      apiClient.admin.tents.addAllToFestival(festivalId, data),
    {
      onSuccess: (_result, variables) => {
        invalidateQueries(QueryKeys.adminFestivalTents(variables.festivalId));
        invalidateQueries(QueryKeys.adminFestivalTentsAvailable(variables.festivalId));
      },
    },
  );
}

/** Hook to copy tent assignments from another festival. */
export function useCopyAdminFestivalTents() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ festivalId, data }: { festivalId: string; data: CopyAdminFestivalTentsInput }) =>
      apiClient.admin.tents.copyToFestival(festivalId, data),
    {
      onSuccess: (_result, variables) => {
        invalidateQueries(QueryKeys.adminFestivalTents(variables.festivalId));
        invalidateQueries(QueryKeys.adminFestivalTentsAvailable(variables.festivalId));
      },
    },
  );
}

/**
 * Hook to set a tent's beer price at a festival.
 *
 * A null price clears it. The server writes the euro column, the cents column
 * and the canonical `drink_type_prices` row together.
 */
export function useSetAdminFestivalTentPrice() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({
      festivalId,
      tentId,
      beerPrice,
    }: {
      festivalId: string;
      tentId: string;
      beerPrice: number | null;
    }) => apiClient.admin.tents.setPrice(festivalId, tentId, beerPrice),
    {
      onSuccess: (_result, variables) => {
        invalidateQueries(QueryKeys.adminFestivalTents(variables.festivalId));
      },
    },
  );
}

/**
 * Hook to stop a festival serving a tent.
 *
 * Rejects with the server's message when people have visited it; callers
 * should surface that text rather than a generic failure.
 */
export function useRemoveAdminFestivalTent() {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useMutation(
    async ({ festivalId, tentId }: { festivalId: string; tentId: string }) =>
      apiClient.admin.tents.removeFromFestival(festivalId, tentId),
    {
      onSuccess: (_result, variables) => {
        invalidateQueries(QueryKeys.adminFestivalTents(variables.festivalId));
        invalidateQueries(QueryKeys.adminFestivalTentsAvailable(variables.festivalId));
      },
    },
  );
}
