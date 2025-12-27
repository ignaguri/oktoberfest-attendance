"use server";

import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";

import "server-only";

export async function getGroupName(groupId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single();

  if (error) {
    reportSupabaseException("getGroupName", error);
    return null;
  }

  return data.name;
}
