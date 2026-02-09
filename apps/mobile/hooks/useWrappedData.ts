/**
 * Mobile-specific hook for fetching wrapped data
 *
 * Uses direct Supabase RPC call to get the full WrappedData format
 * needed by the wrapped slides (same approach as web).
 * The REST API endpoint returns a slimmer format that doesn't include
 * all the data needed for the slide components.
 */

import { QueryKeys } from "@prostcounter/shared/data";
import { useQuery } from "@prostcounter/shared/data";
import type { WrappedData } from "@prostcounter/shared/wrapped";

import { supabase } from "@/lib/supabase";

/**
 * Hook to fetch wrapped data for a specific festival via Supabase RPC
 * Returns the full WrappedData format with all stats needed for slides
 */
export function useWrappedData(festivalId?: string) {
  return useQuery(
    QueryKeys.wrapped(festivalId || ""),
    async (): Promise<WrappedData | null> => {
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

      console.log(
        "[WrappedData] RPC response type:",
        typeof data,
        "keys:",
        data ? Object.keys(data) : "null",
      );

      return data as unknown as WrappedData;
    },
    {
      enabled: !!festivalId,
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
    },
  );
}
