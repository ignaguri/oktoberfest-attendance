"use server";

import { getUser } from "@/lib/actions";
import { createClient } from "@/utils/supabase/server";

import type { Tables } from "@/lib/database.types";

import "server-only";

export async function fetchGroups(): Promise<Tables<"groups">[]> {
  const user = await getUser();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, groups(id, name)")
    .eq("user_id", user.id);

  if (error) {
    throw new Error("Error fetching groups: " + error.message);
  }

  const groups = data.map((item) => item.groups) as Tables<"groups">[];

  return groups;
}
