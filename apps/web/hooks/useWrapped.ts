/**
 * Business logic hooks for wrapped data
 *
 * These hooks handle all wrapped-related functionality using React Query
 */

import {
  getWrappedData,
  canAccessWrapped,
  getAvailableWrappedFestivals,
} from "@/lib/actions/wrapped";
import { useQuery } from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";

/**
 * Hook to fetch wrapped data for a specific festival
 */
export function useWrapped(festivalId?: string) {
  return useQuery(
    QueryKeys.wrapped(festivalId || ""),
    () => getWrappedData(festivalId!),
    {
      enabled: !!festivalId,
      staleTime: 10 * 60 * 1000, // 10 minutes - wrapped data doesn't change often
      gcTime: 30 * 60 * 1000, // 30 minutes cache
      retry: 2, // Retry failed requests twice
    },
  );
}

/**
 * Hook to check if user can access wrapped for a festival
 */
export function useWrappedAccess(festivalId?: string) {
  return useQuery(
    QueryKeys.wrappedAccess(festivalId || ""),
    () => canAccessWrapped(festivalId!),
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
  return useQuery(
    QueryKeys.availableWrapped(),
    () => getAvailableWrappedFestivals(),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes cache
    },
  );
}
