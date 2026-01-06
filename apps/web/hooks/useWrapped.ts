/**
 * Business logic hooks for wrapped data
 *
 * These hooks handle all wrapped-related functionality using React Query
 */

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@/lib/data/react-query-provider";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { QueryKeys } from "@prostcounter/shared/data";

import type { WrappedData } from "@/lib/wrapped/types";

/**
 * Hook to fetch wrapped data for a specific festival
 * Uses direct Supabase call to preserve DB format for wrapped slides
 */
export function useWrappedData(festivalId?: string) {
  return useQuery(
    QueryKeys.wrapped(festivalId || ""),
    async (): Promise<WrappedData | null> => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      const { data, error } = await supabase.rpc("get_wrapped_data_cached", {
        p_user_id: user.id,
        p_festival_id: festivalId!,
      });

      if (error) {
        console.error("Failed to fetch wrapped data:", error);
        return null;
      }

      return data as unknown as WrappedData;
    },
    {
      enabled: !!festivalId,
      staleTime: 10 * 60 * 1000, // 10 minutes - wrapped data doesn't change often
      gcTime: 30 * 60 * 1000, // 30 minutes cache
      retry: 2, // Retry failed requests twice
    },
  );
}

/**
 * Hook to fetch wrapped data via API (simplified format)
 * @deprecated Use useWrappedData for full wrapped slides
 */
export function useWrapped(festivalId?: string) {
  return useQuery(
    [...QueryKeys.wrapped(festivalId || ""), "api"],
    async () => {
      const response = await apiClient.wrapped.get(festivalId!);
      return response.wrapped;
    },
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
    () => apiClient.wrapped.checkAccess(festivalId!),
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
