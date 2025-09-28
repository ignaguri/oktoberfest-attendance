"use server";

import { logger } from "@/lib/logger";
import { createNotificationService } from "@/lib/services/notifications";
import { getProfileShort, getUser } from "@/lib/sharedActions";
import { reportNotificationException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";

import "server-only";

/**
 * Sync user profile with Novu
 */
export async function syncUserWithNovu(): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await getUser();
  try {
    const profile = await getProfileShort();

    const notificationService = createNotificationService();
    await notificationService.subscribeUser(
      user.id,
      user.email || undefined,
      profile.username || profile.full_name?.split(" ")[0] || undefined,
      profile.full_name?.split(" ").slice(1).join(" ") || undefined,
      profile.avatar_url || undefined,
    );

    return { success: true };
  } catch (error) {
    reportNotificationException("syncUserWithNovu", error as Error, {
      id: user.id,
      email: user.email,
    });
    return { success: false, error: "Failed to sync user" };
  }
}

/**
 * Get user notification preferences
 */
export async function getUserNotificationPreferences() {
  const user = await getUser();
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("user_notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) {
      reportNotificationException(
        "getUserNotificationPreferences",
        error as Error,
        {
          id: user.id,
          email: user.email,
        },
      );
      return null;
    }

    return data;
  } catch (error) {
    reportNotificationException(
      "getUserNotificationPreferences",
      error as Error,
      {
        id: user.id,
        email: user.email,
      },
    );
    return null;
  }
}

/**
 * Update user notification preferences
 */
export async function updateUserNotificationPreferences(updates: {
  reminders_enabled?: boolean | null;
  group_notifications_enabled?: boolean | null;
  achievement_notifications_enabled?: boolean | null;
  push_enabled?: boolean | null;
}) {
  const user = await getUser();
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("user_notification_preferences")
      .upsert(
        {
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      )
      .select()
      .single();

    if (error) {
      reportNotificationException(
        "updateUserNotificationPreferences",
        error as Error,
        {
          id: user.id,
          email: user.email,
        },
      );
      throw new Error("Failed to update preferences");
    }

    return data;
  } catch (error) {
    reportNotificationException(
      "updateUserNotificationPreferences",
      error as Error,
      {
        id: user.id,
        email: user.email,
      },
    );
    throw error;
  }
}

export async function registerFCMToken(token: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await getUser();
  if (!user || !user.id) {
    return { success: false, error: "User not authenticated" };
  }

  try {
    const notificationService = createNotificationService();
    const success = await notificationService.registerFCMToken(user.id, token);

    if (success) {
      // Also enable push notifications in preferences if not already enabled
      try {
        await updateUserNotificationPreferences({ push_enabled: true });
      } catch (error) {
        reportNotificationException("registerFCMToken", error as Error, {
          id: user.id,
          email: user.email,
        });
        // Don't fail the entire operation if preference update fails
      }
    }

    return { success };
  } catch (error) {
    reportNotificationException("registerFCMToken", error as Error, {
      id: user.id,
      email: user.email,
    });
    return { success: false, error: "Failed to register token" };
  }
}

export async function updateFCMTokens(tokens: string[]): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await getUser();
  if (!user || !user.id) {
    return { success: false, error: "User not authenticated" };
  }

  try {
    const notificationService = createNotificationService();
    const success = await notificationService.updateFCMTokens(user.id, tokens);

    return { success };
  } catch (error) {
    reportNotificationException("updateFCMTokens", error as Error, {
      id: user.id,
      email: user.email,
    });
    return { success: false, error: "Failed to update tokens" };
  }
}

/**
 * Send location sharing notification with rate limiting
 * Only sends notifications for "started" actions and limits to once every 5 minutes per user
 */
export async function sendLocationSharingNotification(
  groupId: string,
  action: "started" | "stopped",
): Promise<{ success: boolean; error?: string }> {
  // Skip all stopped notifications
  if (action === "stopped") {
    return { success: true };
  }

  const user = await getUser();
  const supabase = createClient();

  try {
    // Check rate limiting - look for recent notifications from this user
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Use raw query since the table might not be in generated types yet
    const { data: recentNotifications, error: rateLimitError } =
      await supabase.rpc("check_notification_rate_limit", {
        p_user_id: user.id,
        p_notification_type: "location_sharing",
        p_group_id: groupId,
        p_minutes_ago: 5,
      });

    if (rateLimitError) {
      logger.warn("Rate limit check failed", {
        error: rateLimitError,
        userId: user.id,
        groupId,
      });
    }

    // If we found a recent notification, skip sending
    if (recentNotifications && recentNotifications > 0) {
      logger.info("Rate limiting location sharing notification", {
        userId: user.id,
        groupId,
        recentNotifications,
      });
      return { success: true }; // Return success but don't send
    }

    // Get user profile and group details
    const profile = await getProfileShort();
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("id, name, festival_id")
      .eq("id", groupId)
      .single();

    if (groupError || !group) {
      throw new Error("Group not found");
    }

    // Get group members to notify (excluding the sharer)
    const { data: groupMembers, error: membersError } = await supabase
      .from("group_members")
      .select("user_id, profiles(username, full_name)")
      .eq("group_id", groupId)
      .neq("user_id", user.id);

    if (membersError) {
      throw new Error("Failed to get group members");
    }

    if (!groupMembers || groupMembers.length === 0) {
      return { success: true }; // No one to notify
    }

    // Send notification to each group member
    const notificationService = createNotificationService();
    const sharerName = profile.full_name || profile.username || "Someone";

    for (const member of groupMembers) {
      if (!member.user_id) continue; // Skip members without user_id

      try {
        await notificationService.novu.trigger({
          workflowId: "location-sharing-notification",
          to: member.user_id,
          payload: {
            sharerName,
            groupName: group.name,
            action,
            festivalId: group.festival_id,
            groupId: group.id,
          },
        });
      } catch (error) {
        logger.warn("Failed to send notification to group member", {
          memberId: member.user_id,
          groupId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Continue with other members even if one fails
      }
    }

    // Record the notification in rate limiting table using RPC
    try {
      await supabase.rpc("record_notification_rate_limit", {
        p_user_id: user.id,
        p_group_id: groupId,
        p_notification_type: "location_sharing",
      });
    } catch (error) {
      logger.warn("Failed to record rate limit entry", {
        userId: user.id,
        groupId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Don't fail the whole operation if rate limit recording fails
    }

    return { success: true };
  } catch (error) {
    reportNotificationException(
      "sendLocationSharingNotification",
      error as Error,
      {
        id: user.id,
        email: user.email,
      },
    );
    return { success: false, error: "Failed to send notification" };
  }
}
