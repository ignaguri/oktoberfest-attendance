"use server";

import { createClient } from "@/utils/supabase/server";

export async function getGroupName(uuid: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("groups")
    .select("name")
    .eq("id", uuid)
    .single();

  if (error) {
    return null;
  }

  return data.name;
}
