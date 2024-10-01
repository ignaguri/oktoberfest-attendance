"use server";

import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";

import "server-only";

export async function fetchGlobalLeaderboard(winningCriteriaId: number) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_global_leaderboard", {
    p_winning_criteria_id: winningCriteriaId,
  });

  if (error) {
    reportSupabaseException("fetchGlobalLeaderboard", error);
    throw new Error(`Error fetching global leaderboard: ${error.message}`);
  }

  return data;
}
