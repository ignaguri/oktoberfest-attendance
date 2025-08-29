"use server";

import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { unstable_cache } from "next/cache";

import type { SupabaseClient } from "@/lib/types";

import "server-only";

// Cache leaderboard for 5 minutes since it updates frequently with new beer entries
const getCachedGlobalLeaderboard = unstable_cache(
  async (
    winningCriteriaId: number,
    festivalId: string | undefined,
    supabaseClient: SupabaseClient,
  ) => {
    const { data, error } = await supabaseClient.rpc("get_global_leaderboard", {
      p_winning_criteria_id: winningCriteriaId,
      p_festival_id: festivalId || undefined,
    });

    if (error) {
      reportSupabaseException("fetchGlobalLeaderboard", error);
      throw new Error(`Error fetching global leaderboard: ${error.message}`);
    }

    return data;
  },
  ["global-leaderboard"],
  { revalidate: 300, tags: ["leaderboard", "attendances"] }, // 5 minutes cache
);

export async function fetchGlobalLeaderboard(
  winningCriteriaId: number,
  festivalId?: string,
) {
  const supabase = createClient();
  return getCachedGlobalLeaderboard(winningCriteriaId, festivalId, supabase);
}
