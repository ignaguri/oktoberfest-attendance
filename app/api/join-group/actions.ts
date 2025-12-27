"use server";

import { logger } from "@/lib/logger";
import { createNotificationService } from "@/lib/services/notifications";
import { getUser } from "@/lib/sharedActions";
import {
  reportNotificationException,
  reportSupabaseException,
} from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";

import "server-only";

// Define the response type for join_group_with_token
type JoinGroupTokenResponse =
  | {
      success: true;
      group_id: string;
      group_name: string;
      message: string;
    }
  | {
      success: false;
      error_code: "TOKEN_NOT_FOUND" | "TOKEN_EXPIRED" | "ALREADY_MEMBER";
      message: string;
      group_name?: string;
      group_id?: string;
      expired_at?: string;
    };

export async function joinGroupWithToken(formData: { token: string }) {
  const supabase = await createClient();
  const user = await getUser();

  const { data, error } = await supabase.rpc("join_group_with_token", {
    p_user_id: user.id,
    p_token: formData.token,
  });

  if (error) {
    reportSupabaseException("joinGroupWithToken", error, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error joining group with token");
  }

  // Parse the JSONB response
  const result = data as JoinGroupTokenResponse;

  if (!result.success) {
    // Throw specific error types based on error_code
    const errorMessage = result.message || "Error joining group with token";

    if (result.error_code === "TOKEN_EXPIRED") {
      const error = new Error(errorMessage) as Error & {
        code: string;
        groupName?: string;
        groupId?: string;
        expiredAt?: string;
      };
      error.code = "TOKEN_EXPIRED";
      error.groupName = result.group_name;
      error.groupId = result.group_id;
      error.expiredAt = result.expired_at;
      throw error;
    } else if (result.error_code === "ALREADY_MEMBER") {
      const error = new Error(errorMessage) as Error & {
        code: string;
        groupName?: string;
        groupId?: string;
      };
      error.code = "ALREADY_MEMBER";
      error.groupName = result.group_name;
      error.groupId = result.group_id;
      throw error;
    } else {
      const error = new Error(errorMessage) as Error & {
        code: string;
      };
      error.code = result.error_code || "TOKEN_INVALID";
      throw error;
    }
  }

  const groupId = result.group_id;

  try {
    const notificationService = createNotificationService();
    await notificationService.notifyGroupJoin(groupId, user.id);
  } catch (notificationError) {
    reportNotificationException(
      "joinGroupWithToken",
      notificationError as Error,
      {
        id: user.id,
        email: user.email,
      },
    );
    logger.warn(
      "Failed to send join notification",
      logger.serverAction("joinGroupWithToken", { userId: user.id, groupId }),
      notificationError as Error,
    );
    // Don't fail the join operation if notification fails
  }

  // Invalidate relevant caches for group membership changes
  revalidateTag("groups", "max");
  revalidateTag("user-groups", "max");
  revalidateTag("group-members", "max");

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/home");

  return groupId;
}
