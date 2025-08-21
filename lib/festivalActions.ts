"use server";

import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";

import type { Festival, FestivalTentPricing } from "@/lib/types";

import "server-only";

export async function fetchFestivals(): Promise<Festival[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("festivals")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    reportSupabaseException("fetchFestivals", error);
    throw new Error(`Error fetching festivals: ${error.message}`);
  }

  return data || [];
}

export async function fetchActiveFestival(): Promise<Festival | null> {
  const supabase = createClient();

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
}

export async function fetchFestivalById(
  festivalId: string,
): Promise<Festival | null> {
  const supabase = createClient();

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
}

export async function fetchFestivalTentPricing(
  festivalId: string,
): Promise<FestivalTentPricing[]> {
  const supabase = createClient();

  const { data, error } = await supabase
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
