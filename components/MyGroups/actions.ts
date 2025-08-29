"use server";

import { getUser } from "@/lib/sharedActions";
import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { unstable_cache } from "next/cache";

import type { Tables } from "@/lib/database.types";

import "server-only";

// Cache user groups for 10 minutes since group membership changes infrequently
const getCachedUserGroups = unstable_cache(
  async (
    userId: string,
    festivalId: string | undefined,
    supabaseClient: any,
  ): Promise<Tables<"groups">[]> => {
    let query = supabaseClient
      .from("group_members")
      .select("group_id, groups(id, name, festival_id)")
      .eq("user_id", userId);

    // Filter by festival if provided
    if (festivalId) {
      query = query.eq("groups.festival_id", festivalId);
    }

    const { data, error } = await query;

    if (error) {
      reportSupabaseException("fetchGroups", error, {
        id: userId,
      });

      throw new Error("Error fetching groups: " + error.message);
    }

    const groups = data
      .map((item: any) => item.groups)
      .filter((group: any): group is Tables<"groups"> => group !== null);

    return groups;
  },
  ["user-groups"],
  { revalidate: 600, tags: ["groups", "user-groups"] }, // 10 minutes cache
);

export async function fetchGroups(
  festivalId?: string,
): Promise<Tables<"groups">[]> {
  const user = await getUser();
  const supabase = createClient();
  return getCachedUserGroups(user.id, festivalId, supabase);
}
