"use server";

import { getUser } from "@/lib/sharedActions";
import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";

import type { Tables } from "@/lib/database.types";

import "server-only";

export async function fetchGroups(
  festivalId?: string,
): Promise<Tables<"groups">[]> {
  const user = await getUser();
  const supabase = createClient();

  let query = supabase
    .from("group_members")
    .select("group_id, groups(id, name, festival_id)")
    .eq("user_id", user.id);

  // Filter by festival if provided
  if (festivalId) {
    query = query.eq("groups.festival_id", festivalId);
  }

  const { data, error } = await query;

  if (error) {
    reportSupabaseException("fetchGroups", error, {
      id: user.id,
      email: user.email,
    });

    throw new Error("Error fetching groups: " + error.message);
  }

  const groups = data
    .map((item) => item.groups)
    .filter((group): group is Tables<"groups"> => group !== null);

  return groups;
}
