/**
 * Shared hooks for wrapped data
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import { useApiClient, useQuery, QueryKeys } from "../data";
import type { WrappedAccessResult, WrappedData } from "../wrapped/types";

/**
 * Hook to check if user can access wrapped for a festival
 */
export function useWrappedAccess(festivalId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.wrappedAccess(festivalId || ""),
    async (): Promise<WrappedAccessResult> =>
      apiClient.wrapped.checkAccess(festivalId!),
    {
      enabled: !!festivalId,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes cache
      retry: 1,
    },
  );
}

/**
 * Hook to fetch list of festivals with wrapped available
 */
export function useAvailableWrappedFestivals() {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.availableWrapped(),
    async () => {
      const response = await apiClient.wrapped.getAvailableFestivals();
      return response.festivals;
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes cache
    },
  );
}

/**
 * Hook to fetch wrapped data for a specific festival via API
 */
export function useWrappedDataApi(festivalId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.wrapped(festivalId || ""),
    async (): Promise<WrappedData | null> => {
      const response = await apiClient.wrapped.get(festivalId!);
      return response.wrapped ?? null;
    },
    {
      enabled: !!festivalId,
      staleTime: 10 * 60 * 1000, // 10 minutes - wrapped data doesn't change often
      gcTime: 30 * 60 * 1000, // 30 minutes cache
      retry: 2,
    },
  );
}

/**
 * Hook to generate wrapped data for a specific festival
 */
export function useGenerateWrapped(festivalId?: string) {
  const apiClient = useApiClient();

  return useQuery(
    [...QueryKeys.wrapped(festivalId || ""), "generate"],
    async () => {
      const response = await apiClient.wrapped.generate(festivalId!);
      return response.wrapped;
    },
    {
      enabled: false, // Only trigger manually
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
    },
  );
}
