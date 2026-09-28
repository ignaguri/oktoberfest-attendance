/**
 * Shared hooks for Wrapped. Both apps read through the API, which records the
 * view (wrapped_viewed achievement, wrapped_views analytics) on status=ready.
 */

import { QueryKeys, useApiClient, useInvalidateQueries, useQuery } from "../data";
import type { GetWrappedResponse, WrappedFestival } from "../schemas/wrapped.schema";

/**
 * Only a ready Wrapped is worth keeping: a locked answer has to be refetched
 * once unlocksAt passes, or reopening shows a countdown that already ended.
 */
export function wrappedStaleTime(response: GetWrappedResponse | undefined): number {
  return response?.status === "ready" ? 10 * 60 * 1000 : 0;
}

export function useWrapped(festivalId?: string) {
  const apiClient = useApiClient();
  const invalidateQueries = useInvalidateQueries();

  return useQuery(
    QueryKeys.wrapped(festivalId || ""),
    async (): Promise<GetWrappedResponse> => {
      const response = await apiClient.wrapped.get(festivalId!);
      if (response.status === "ready") {
        // Evaluate-only route: the unlock reaches the client through the
        // outbox, so nudge the pending query instead of waiting for focus.
        invalidateQueries(QueryKeys.pendingUnlocks());
        // The archive's "new" dot depends on the view just recorded.
        invalidateQueries(QueryKeys.wrappedFestivals());
      }
      return response;
    },
    {
      enabled: !!festivalId,
      staleTime: (data) => wrappedStaleTime(data as GetWrappedResponse | undefined),
      gcTime: 30 * 60 * 1000,
      retry: 2,
    },
  );
}

export function useWrappedFestivals() {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.wrappedFestivals(),
    async (): Promise<WrappedFestival[]> => {
      const response = await apiClient.wrapped.list();
      return response.festivals;
    },
    {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
    },
  );
}
