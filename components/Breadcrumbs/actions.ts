"use server";

import { createClient } from "@/utils/supabase/server";

import "server-only";

export async function getGroupName(groupId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single();

  if (error) {
    return null;
  }

  return data.name;
}
