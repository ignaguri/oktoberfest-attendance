"use server";

import { createNotificationService } from "@/lib/services/notifications";
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

  // Trigger notification to group admin
  console.log(
    "🚀 JoinGroupAPI: Attempting to send notification for group join",
    { groupId, userId: user.id },
  );
  try {
    const notificationService = createNotificationService();
    await notificationService.notifyGroupJoin(groupId, user.id);
    console.log("✅ JoinGroupAPI: Notification service call completed");
  } catch (notificationError) {
    console.error(
      "💥 JoinGroupAPI: Failed to send join notification:",
      notificationError,
    );
    // Don't fail the join operation if notification fails
  }

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/home");

  return groupId;
}
