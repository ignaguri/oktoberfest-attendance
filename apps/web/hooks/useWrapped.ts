/**
 * Web-specific business logic hooks for wrapped data
 *
 * useWrappedData uses direct Supabase RPC for full data format needed by web slides.
 * Access and festival hooks have been moved to @prostcounter/shared/hooks.
 */

import { QueryKeys } from "@prostcounter/shared/data";
import type { WrappedData } from "@prostcounter/shared/wrapped";

import { useQuery } from "@/lib/data/react-query-provider";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

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
