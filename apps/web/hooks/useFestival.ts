/**
 * Business logic hooks for festival data
 *
 * These hooks provide access to festival data through the abstraction layer
 * They can eventually replace or complement the FestivalContext
 */

import { useQuery } from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";
import {
  fetchFestivals,
  fetchActiveFestival,
  fetchFestivalById,
} from "@/lib/festivalActions";

/**
 * Hook to fetch all festivals
 */
export function useFestivals() {
  return useQuery(QueryKeys.festivals(), () => fetchFestivals(), {
    staleTime: 60 * 60 * 1000, // 1 hour - festivals don't change often
    gcTime: 2 * 60 * 60 * 1000, // 2 hours cache
  });
}

/**
 * Hook to fetch the active festival
 */
export function useActiveFestival() {
  return useQuery(QueryKeys.activeFestival(), () => fetchActiveFestival(), {
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour cache
  });
}

/**
 * Hook to fetch a specific festival by ID
 */
export function useFestivalById(festivalId: string) {
  return useQuery(
    QueryKeys.festival(festivalId),
    () => fetchFestivalById(festivalId),
    {
      enabled: !!festivalId,
      staleTime: 60 * 60 * 1000, // 1 hour
      gcTime: 2 * 60 * 60 * 1000, // 2 hours cache
    },
  );
}
