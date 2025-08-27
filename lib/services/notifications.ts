import { DEFAULT_AVATAR_URL } from "@/lib/constants";
import { createClient } from "@/utils/supabase/server";
import { Novu } from "@novu/node";

import type { Tables } from "@/lib/database.types";

type NotificationPreferences = Tables<"user_notification_preferences">;

/**
 * Notification workflow identifiers
 * These should match the workflow IDs configured in Novu
 */
export const NOTIFICATION_WORKFLOWS = {
  GROUP_JOIN: "group-join-notification",
  TENT_CHECKIN: "tent-check-in-notification",
} as const;

/**
 * Type for notification workflow IDs
 */
export type NotificationWorkflowId =
  (typeof NOTIFICATION_WORKFLOWS)[keyof typeof NOTIFICATION_WORKFLOWS];

export class NotificationService {
  private supabase;
  private novu: Novu;

  constructor() {
    // Use service role to access all user data for notifications
    this.supabase = createClient(true);

    // Initialize Novu with API key
    const novuApiKey = process.env.NOVU_API_KEY;
    if (!novuApiKey) {
      throw new Error("NOVU_API_KEY environment variable is required");
    }
    this.novu = new Novu(novuApiKey);
  }

  /**
   * Notify group admin when someone joins their group
   */
  async notifyGroupJoin(groupId: string, newUserId: string): Promise<void> {
    try {
      // Get group details
      const { data: group, error: groupError } = await this.supabase
        .from("groups")
        .select("name, created_by")
        .eq("id", groupId)
        .single();

      if (groupError || !group) {
        return;
      }

      // Check admin ID
      const adminId = group.created_by;
      if (!adminId) {
        return;
      }

      // Get new member info
      const { data: newMember, error: memberError } = await this.supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", newUserId)
        .single();

      if (memberError || !newMember) {
        return;
      }

      // Get admin's notification preferences
      const { data: preferences, error: prefsError } = await this.supabase
        .from("user_notification_preferences")
        .select("group_join_enabled, push_enabled")
        .eq("user_id", adminId)
        .single();

      if (prefsError) {
        // Continue with defaults
      }

      // Skip if admin has disabled group join notifications
      if (preferences && !preferences.group_join_enabled) {
        return;
      }

      // Prepare notification payload
      const joinerName = newMember.username ?? newMember.full_name ?? "Someone";
      // Use actual avatar URL if available, otherwise use a default
      const joinerAvatar =
        newMember.avatar_url && newMember.avatar_url.trim()
          ? newMember.avatar_url
          : DEFAULT_AVATAR_URL;

      const payload = {
        joinerName,
        groupName: group.name,
        joinerAvatar,
        groupId,
      };

      // Trigger Novu workflow
      await this.novu.trigger(NOTIFICATION_WORKFLOWS.GROUP_JOIN, {
        to: {
          subscriberId: adminId,
        },
        payload,
      });
    } catch (error) {
      console.error("Error sending group join notification:", error);
    }
  }

  /**
   * Notify group members when someone checks into a tent
   */
  async notifyTentCheckin(
    userId: string,
    tentName: string,
    groupIds: string[],
  ): Promise<void> {
    try {
      if (groupIds.length === 0) {
        return;
      }

      // Get user info
      const { data: user, error: userError } = await this.supabase
        .from("profiles")
        .select("username, full_name")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        console.error("Error fetching user:", userError);
        return;
      }

      // Get group names for better notification context
      const { data: groups, error: groupsError } = await this.supabase
        .from("groups")
        .select("name")
        .in("id", groupIds);

      if (groupsError) {
        console.error("Error fetching group names:", groupsError);
        return;
      }

      const groupNames = groups?.map((g) => g.name).filter(Boolean) || [];
      const groupNamesText =
        groupNames.length > 0 ? groupNames.join(", ") : "Group";

      // Get all group members (excluding the user who checked in)
      const { data: groupMembers, error: membersError } = await this.supabase
        .from("group_members")
        .select("user_id")
        .in("group_id", groupIds)
        .neq("user_id", userId);

      if (membersError) {
        console.error("Error fetching group members:", membersError);
        return;
      }

      if (!groupMembers || groupMembers.length === 0) {
        return;
      }

      // Get notification preferences for these members
      const memberIds = groupMembers.map((member) => member.user_id);
      const { data: preferences, error: prefsError } = await this.supabase
        .from("user_notification_preferences")
        .select("user_id, checkin_enabled, push_enabled")
        .in("user_id", memberIds)
        .eq("checkin_enabled", true);

      if (prefsError) {
        console.error("Error fetching member preferences:", prefsError);
        return;
      }

      const membersToNotify = preferences || [];

      if (membersToNotify.length === 0) {
        return;
      }

      const userName = user.username || user.full_name || "Someone";

      // Send notifications to all eligible members
      const notificationPromises = membersToNotify.map((member) =>
        this.novu.trigger(NOTIFICATION_WORKFLOWS.TENT_CHECKIN, {
          to: {
            subscriberId: member.user_id!,
          },
          payload: {
            userName,
            tentName,
            groupName: groupNamesText,
          },
        }),
      );

      await Promise.allSettled(notificationPromises);
    } catch (error) {
      console.error("Error sending tent checkin notifications:", error);
    }
  }

  /**
   * Get user's notification preferences
   */
  async getUserNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreferences | null> {
    const { data, error } = await this.supabase
      .from("user_notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching notification preferences:", error);
      return null;
    }

    return data;
  }

  /**
   * Update user's notification preferences
   */
  async updateUserNotificationPreferences(
    userId: string,
    preferences: Partial<
      Pick<
        NotificationPreferences,
        "group_join_enabled" | "checkin_enabled" | "push_enabled"
      >
    >,
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("user_notification_preferences")
      .upsert({
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Error updating notification preferences:", error);
      return false;
    }

    return true;
  }

  /**
   * Subscribe user to Novu notifications with full profile data
   */
  async subscribeUser(
    userId: string,
    userEmail?: string,
    firstName?: string,
    lastName?: string,
    avatar?: string,
  ): Promise<void> {
    try {
      console.debug("🔗 NotificationService: Identifying user in Novu:", {
        userId,
        email: userEmail,
        firstName,
        lastName,
        avatar,
      });

      await this.novu.subscribers.identify(userId, {
        email: userEmail,
        firstName,
        lastName,
        avatar,
      });
    } catch (error) {
      console.error(
        "Error identifying user in Novu:",
        { userId, email: userEmail, firstName, lastName, avatar },
        error,
      );
    }
  }

  /**
   * Register FCM device token with Novu subscriber
   */
  async registerFCMToken(userId: string, token: string): Promise<boolean> {
    try {
      await this.novu.subscribers.setCredentials(userId, "fcm", {
        deviceTokens: [token],
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update FCM device tokens for a subscriber
   * This replaces all existing tokens with the new ones
   */
  async updateFCMTokens(userId: string, tokens: string[]): Promise<boolean> {
    try {
      await this.novu.subscribers.setCredentials(userId, "fcm", {
        deviceTokens: tokens,
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Factory function to create instance on demand
export const createNotificationService = () => new NotificationService();
