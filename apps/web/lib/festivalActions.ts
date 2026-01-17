"use server";

import "server-only";

import { unstable_cache } from "next/cache";

import type { Festival, FestivalTent } from "@/lib/types";
import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";

// Cache festivals data for 1 hour since it changes infrequently
const getCachedFestivals = unstable_cache(
  async (): Promise<Festival[]> => {
    // Use service role client - this is public data, no user auth needed
    const supabase = await createClient(true);
    const { data, error } = await supabase
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
  return getCachedFestivals();
}

// Cache active festival for 30 minutes since it changes more frequently
const getCachedActiveFestival = unstable_cache(
  async (): Promise<Festival | null> => {
    // Use service role client - this is public data, no user auth needed
    const supabase = await createClient(true);
    const { data, error } = await supabase
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
  return getCachedActiveFestival();
}

// Cache individual festival for 1 hour with festival ID as part of cache key
const getCachedFestivalById = unstable_cache(
  async (festivalId: string): Promise<Festival | null> => {
    // Use service role client - this is public data, no user auth needed
    const supabase = await createClient(true);
    const { data, error } = await supabase
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
  return getCachedFestivalById(festivalId);
}

// Cache festival tents for 2 hours since they rarely change
const getCachedFestivalTents = unstable_cache(
  async (festivalId: string): Promise<FestivalTent[]> => {
    // Use service role client - this is public data, no user auth needed
    const supabase = await createClient(true);
    const { data, error } = await supabase
      .from("festival_tents")
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
      reportSupabaseException("fetchFestivalTents", error);
      throw new Error(`Error fetching festival tents: ${error.message}`);
    }

    return data || [];
  },
  ["festival-tents"],
  { revalidate: 7200, tags: ["festivals", "tents", "festival-tents"] }, // 2 hours cache
);

export async function fetchFestivalTents(
  festivalId: string,
): Promise<FestivalTent[]> {
  return getCachedFestivalTents(festivalId);
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
