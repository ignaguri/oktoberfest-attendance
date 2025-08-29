"use server";

import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { unstable_cache } from "next/cache";

import type { Festival, FestivalTentPricing } from "@/lib/types";

import "server-only";

// Cache festivals data for 1 hour since it changes infrequently
const getCachedFestivals = unstable_cache(
  async (supabaseClient: any): Promise<Festival[]> => {
    const { data, error } = await supabaseClient
      .from("festivals")
      .select("*")
      .order("start_date", { ascending: false });

    if (error) {
      reportSupabaseException("fetchFestivals", error);
      throw new Error(`Error fetching festivals: ${error.message}`);
    }

    return data || [];
  },
  ["festivals"],
  { revalidate: 3600, tags: ["festivals"] }, // 1 hour cache
);

export async function fetchFestivals(): Promise<Festival[]> {
  const supabase = createClient();
  return getCachedFestivals(supabase);
}

// Cache active festival for 30 minutes since it changes more frequently
const getCachedActiveFestival = unstable_cache(
  async (supabaseClient: any): Promise<Festival | null> => {
    const { data, error } = await supabaseClient
      .from("festivals")
      .select("*")
      .eq("is_active", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No active festival found
        return null;
      }
      reportSupabaseException("fetchActiveFestival", error);
      throw new Error(`Error fetching active festival: ${error.message}`);
    }

    return data;
  },
  ["active-festival"],
  { revalidate: 1800, tags: ["festivals", "active-festival"] }, // 30 minutes cache
);

export async function fetchActiveFestival(): Promise<Festival | null> {
  const supabase = createClient();
  return getCachedActiveFestival(supabase);
}

// Cache individual festival for 1 hour with festival ID as part of cache key
const getCachedFestivalById = unstable_cache(
  async (festivalId: string, supabaseClient: any): Promise<Festival | null> => {
    const { data, error } = await supabaseClient
      .from("festivals")
      .select("*")
      .eq("id", festivalId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      reportSupabaseException("fetchFestivalById", error);
      throw new Error(`Error fetching festival: ${error.message}`);
    }

    return data;
  },
  ["festival-by-id"],
  { revalidate: 3600, tags: ["festivals"] }, // 1 hour cache
);

export async function fetchFestivalById(
  festivalId: string,
): Promise<Festival | null> {
  const supabase = createClient();
  return getCachedFestivalById(festivalId, supabase);
}

// Cache festival tent pricing for 2 hours since pricing rarely changes
const getCachedFestivalTentPricing = unstable_cache(
  async (
    festivalId: string,
    supabaseClient: any,
  ): Promise<FestivalTentPricing[]> => {
    const { data, error } = await supabaseClient
      .from("festival_tent_pricing")
      .select(
        `
        *,
        tent:tents (
          id,
          name,
          category
        )
      `,
      )
      .eq("festival_id", festivalId);

    if (error) {
      reportSupabaseException("fetchFestivalTentPricing", error);
      throw new Error(`Error fetching festival tent pricing: ${error.message}`);
    }

    return data || [];
  },
  ["festival-tent-pricing"],
  { revalidate: 7200, tags: ["festivals", "tents", "pricing"] }, // 2 hours cache
);

export async function fetchFestivalTentPricing(
  festivalId: string,
): Promise<FestivalTentPricing[]> {
  const supabase = createClient();
  return getCachedFestivalTentPricing(festivalId, supabase);
}

export async function getCurrentFestivalForUser(): Promise<Festival | null> {
  // For now, return the active festival or most recent festival
  // Later, this could be enhanced to remember user's last selected festival
  const activeFestival = await fetchActiveFestival();

  if (activeFestival) {
    return activeFestival;
  }

  // If no active festival, return the most recent one
  const festivals = await fetchFestivals();
  return festivals.length > 0 ? festivals[0] : null;
}
