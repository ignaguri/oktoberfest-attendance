"use server";

import { COST_PER_BEER } from "@/lib/constants";
import { getProfileShort, getUser } from "@/lib/sharedActions";
import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";

import "server-only";

export async function getMissingProfileFields() {
  const profileData = await getProfileShort();

  let missingFields = {
    fullName: !profileData.full_name,
    username: !profileData.username,
    avatarUrl: !profileData.avatar_url,
  };

  return missingFields;
}

export async function fetchHighlights() {
  const user = await getUser();

  const supabase = createClient();
  type TopPosition = {
    group_id: string;
    group_name: string;
  };
  const { data, error } = await supabase.rpc("get_user_stats", {
    input_user_id: user.id,
  });
  const { data: profileData } = await supabase
    .from("profiles")
    .select("custom_beer_cost")
    .eq("id", user.id)
    .single();

  if (error) {
    reportSupabaseException("fetchHighlights", error, {
      id: user.id,
      email: user.email,
    });
    return {
      topPositions: [],
      totalBeers: 0,
      daysAttended: 0,
      custom_beer_cost: profileData?.custom_beer_cost ?? COST_PER_BEER,
    };
  }
  if (!data || !Array.isArray(data) || data.length === 0) {
    return {
      topPositions: [],
      totalBeers: 0,
      daysAttended: 0,
      custom_beer_cost: COST_PER_BEER,
    };
  }
  const firstItem = data[0];
  const result = {
    topPositions: (firstItem.top_positions as unknown as TopPosition[]) || [],
    totalBeers: firstItem.total_beers || 0,
    daysAttended: firstItem.days_attended || 0,
    custom_beer_cost: profileData?.custom_beer_cost ?? COST_PER_BEER,
  };

  return result;
}
