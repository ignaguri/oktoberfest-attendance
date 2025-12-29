"use server";

import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";

import "server-only";

export async function renewGroupToken(groupId: string) {
  const supabase = await createClient();

  const { data: newToken, error } = await supabase.rpc("renew_group_token", {
    p_group_id: groupId,
  });

  if (error || !newToken) {
    if (error) {
      reportSupabaseException("renewGroupToken", error);
    }
    throw new Error("Error renewing group token");
  }

  return newToken;
}
