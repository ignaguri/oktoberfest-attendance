"use server";

import { getUser } from "@/lib/sharedActions";
import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

import "server-only";

export async function joinGroupWithToken(formData: { token: string }) {
  const supabase = createClient();
  const user = await getUser();

  const { data: groupId, error } = await supabase.rpc("join_group_with_token", {
    p_user_id: user.id,
    p_token: formData.token,
  });

  if (error || !groupId) {
    if (error) {
      reportSupabaseException("joinGroupWithToken", error, {
        id: user.id,
        email: user.email,
      });
    }
    throw new Error("Error joining group with token");
  }

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/home");

  return groupId;
}
