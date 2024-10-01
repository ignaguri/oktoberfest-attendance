"use server";

import { createClient } from "@/utils/supabase/server";

import "server-only";

export async function renewGroupToken(groupId: string) {
  const supabase = createClient();

  const { data: newToken, error } = await supabase.rpc("renew_group_token", {
    p_group_id: groupId,
  });

  if (error || !newToken) {
    throw new Error("Error renewing group token");
  }

  return newToken;
}
