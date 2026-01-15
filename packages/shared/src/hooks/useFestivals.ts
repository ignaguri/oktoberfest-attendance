/**
 * Shared hooks for festival data
 *
 * Uses ApiClientContext to get the platform-specific API client
 */

import { useApiClient, useQuery, QueryKeys } from "../data";

/**
 * Hook to fetch all festivals
 */
export function useFestivals() {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.festivals(),
    async () => {
      const response = await apiClient.festivals.list({});
      return response.data || [];
    },
    {
      staleTime: 60 * 60 * 1000, // 1 hour - festivals don't change often
      gcTime: 2 * 60 * 60 * 1000, // 2 hours cache
    },
  );
}

/**
 * Hook to fetch the active festival
 */
export function useActiveFestival() {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.activeFestival(),
    async () => {
      const response = await apiClient.festivals.list({ isActive: true });
      // Return first active festival or null
      return response.data?.[0] || null;
    },
    {
      staleTime: 30 * 60 * 1000, // 30 minutes
      gcTime: 60 * 60 * 1000, // 1 hour cache
    },
  );
}

/**
 * Hook to fetch a specific festival by ID
 */
export function useFestivalById(festivalId: string) {
  const apiClient = useApiClient();

  return useQuery(
    QueryKeys.festival(festivalId),
    async () => {
      return await apiClient.festivals.get(festivalId);
    },
    {
      enabled: !!festivalId,
      staleTime: 60 * 60 * 1000, // 1 hour
      gcTime: 2 * 60 * 60 * 1000, // 2 hours cache
    },
  );
}
