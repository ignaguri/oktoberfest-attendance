/**
 * Business logic hooks for tent-related data
 *
 * Migrated to use Hono API client instead of server actions
 */

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@/lib/data/react-query-provider";
import { QueryKeys } from "@/lib/data/types";
import { useMemo } from "react";

import type { Tables } from "@/lib/database.types";

export interface TentOption {
  value: string;
  label: string;
}

export interface TentGroup {
  category: string;
  options: TentOption[];
}

/**
 * Hook to fetch tents with optional festival filtering
 * Uses TanStack Query for caching and automatic background updates
 *
 * @param festivalId Optional festival ID to filter tents for a specific festival
 */
export function useTents(festivalId?: string) {
  // Use different query keys for festival-specific vs all tents
  const queryKey = festivalId
    ? QueryKeys.tents(festivalId)
    : QueryKeys.allTents();

  const query = useQuery(
    queryKey,
    async () => {
      const response = await apiClient.tents.list({ festivalId });
      return response.tents || [];
    },
    {
      staleTime: 30 * 60 * 1000, // 30 minutes - tents don't change frequently
      gcTime: 2 * 60 * 60 * 1000, // 2 hours cache
      enabled: true, // Always enabled since API handles undefined festivalId
    },
  );

  // Transform raw tent data into grouped structure
  const groupedTents: TentGroup[] = useMemo(() => {
    if (!query.data) return [];

    return query.data.reduce((acc: TentGroup[], tent: Tables<"tents">) => {
      const category = tent.category
        ? tent.category.charAt(0).toUpperCase() + tent.category.slice(1)
        : "Uncategorized";

      const existingCategory = acc.find(
        (g: TentGroup) => g.category === category,
      );

      if (existingCategory) {
        existingCategory.options.push({
          value: tent.id,
          label: tent.name,
        });
      } else {
        acc.push({
          category,
          options: [{ value: tent.id, label: tent.name }],
        });
      }

      return acc;
    }, [] as TentGroup[]);
  }, [query.data]);

  return {
    tents: groupedTents,
    isLoading: query.loading,
    error: query.error?.message || null,
    refetch: query.refetch,
    isInitialLoading: query.isInitialLoading,
    isRefetching: query.isRefetching,
    // Raw tent data for cases where grouping isn't needed
    rawTents: query.data || [],
  };
}

/**
 * Hook to get a specific tent by ID
 * Leverages cached tent data to avoid additional API calls
 */
export function useTentById(tentId: string, festivalId?: string) {
  const { rawTents, isLoading, error } = useTents(festivalId);

  const tent = useMemo(() => {
    return rawTents.find((t: Tables<"tents">) => t.id === tentId) || null;
  }, [rawTents, tentId]);

  return {
    tent,
    isLoading,
    error,
  };
}

/**
 * Hook to get tents by category
 * Filters cached tent data by category
 */
export function useTentsByCategory(category: string, festivalId?: string) {
  const { rawTents, isLoading, error } = useTents(festivalId);

  const tents = useMemo(() => {
    return rawTents.filter(
      (t: Tables<"tents">) =>
        t.category?.toLowerCase() === category.toLowerCase(),
    );
  }, [rawTents, category]);

  return {
    tents,
    isLoading,
    error,
  };
}
