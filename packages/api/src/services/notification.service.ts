import { Novu } from "@novu/api";
import { ChatOrPushProviderEnum } from "@novu/api/models/components";

import type { Database } from "@prostcounter/db";
import type { UpdateNotificationPreferencesInput } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

type NotificationPreferences =
  Database["public"]["Tables"]["user_notification_preferences"]["Row"];

/**
 * Notification workflow identifiers
 * These should match the workflow IDs configured in Novu
 */
export const NOTIFICATION_WORKFLOWS = {
  GROUP_JOIN: "group-join",
  LOCATION_SHARING: "location-sharing-started",
  TENT_CHECKIN: "tent-check-in",
  RESERVATION_REMINDER: "reservation-reminder",
  RESERVATION_CHECKIN_PROMPT: "reservation-prompt",
  ACHIEVEMENT_UNLOCKED: "achievement-unlocked",
  GROUP_ACHIEVEMENT_UNLOCKED: "group-achievement-unlocked",
} as const;

export type NotificationWorkflowId =
  (typeof NOTIFICATION_WORKFLOWS)[keyof typeof NOTIFICATION_WORKFLOWS];

/**
 * Notification Service
 * Handles notification triggering, FCM token management, and user preferences
 */
export class NotificationService {
  private novu: Novu;

  constructor(
    private supabase: SupabaseClient<Database>,
    private novuApiKey: string,
  ) {
    if (!novuApiKey) {
      throw new Error("NOVU_API_KEY is required");
    }
    this.novu = new Novu({
      secretKey: novuApiKey,
    });
  }

  /**
   * Register FCM device token with Novu subscriber
   */
  async registerFCMToken(userId: string, token: string): Promise<boolean> {
    try {
      await this.novu.subscribers.credentials.update(
        {
          providerId: ChatOrPushProviderEnum.Fcm,
          credentials: {
            deviceTokens: [token],
          },
        },
        userId,
      );
      return true;
    } catch (error) {
      console.error("Error registering FCM token:", error);
      return false;
    }
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
  ): Promise<boolean> {
    try {
      await this.novu.subscribers.create({
        subscriberId: userId,
        email: userEmail,
        firstName,
        lastName,
        avatar,
      });
      return true;
    } catch (error) {
      console.error("Error subscribing user:", error);
      return false;
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
    preferences: UpdateNotificationPreferencesInput,
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("user_notification_preferences")
      .upsert(
        {
          user_id: userId,
          push_enabled: preferences.pushEnabled,
          group_join_enabled: preferences.groupJoinEnabled,
          checkin_enabled: preferences.checkinEnabled,
          reminders_enabled: preferences.remindersEnabled,
          achievement_notifications_enabled:
            preferences.achievementNotificationsEnabled,
          group_notifications_enabled: preferences.groupNotificationsEnabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (error) {
      console.error("Error updating notification preferences:", error);
      return false;
    }

    return true;
  }

  /**
   * Send reservation reminder to a user (respects reminders_enabled)
   */
  async notifyReservationReminder(
    userId: string,
    payload: {
      reservationId: string;
      tentName: string;
      startAtISO: string;
      festivalName?: string;
    },
  ): Promise<void> {
    try {
      const prefs = await this.getUserNotificationPreferences(userId);

      if (prefs && prefs.reminders_enabled === false) {
        return;
      }

      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.RESERVATION_REMINDER,
        to: userId,
        payload,
      });
    } catch (error) {
      console.error("Error sending reservation reminder:", error);
    }
  }

  /**
   * Send reservation check-in prompt to a user at reservation start time
   * (respects reminders_enabled)
   */
  async notifyReservationPrompt(
    userId: string,
    payload: {
      reservationId: string;
      tentName: string;
      deepLinkUrl: string;
    },
  ): Promise<void> {
    try {
      const prefs = await this.getUserNotificationPreferences(userId);

      if (prefs && prefs.reminders_enabled === false) {
        return;
      }

      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.RESERVATION_CHECKIN_PROMPT,
        to: userId,
        payload,
      });
    } catch (error) {
      console.error("Error sending reservation prompt:", error);
    }
  }

  /**
   * Notify a user about their unlocked achievement
   * (respects achievement_notifications_enabled)
   */
  async notifyAchievementUnlocked(
    userId: string,
    payload: {
      achievementName: string;
      description?: string;
      rarity: "common" | "rare" | "epic";
      achievementId: string;
    },
  ): Promise<void> {
    try {
      const prefs = await this.getUserNotificationPreferences(userId);

      if (prefs && prefs.achievement_notifications_enabled === false) {
        return;
      }

      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.ACHIEVEMENT_UNLOCKED,
        to: userId,
        payload,
      });
    } catch (error) {
      console.error("Error sending achievement notification:", error);
    }
  }

  /**
   * Notify a list of recipients about someone else's rare/epic achievement
   * (respects group_notifications_enabled)
   */
  async notifyGroupAchievement(
    recipientIds: string[],
    payload: {
      achieverName: string;
      achievementName: string;
      rarity: "rare" | "epic";
      groupName?: string;
    },
  ): Promise<void> {
    try {
      if (recipientIds.length === 0) return;

      // Filter by group_notifications_enabled
      const { data: prefsList, error } = await this.supabase
        .from("user_notification_preferences")
        .select("user_id, group_notifications_enabled")
        .in("user_id", recipientIds);

      if (error) {
        console.error(
          "Error fetching preferences for group achievement:",
          error,
        );
        return;
      }

      const enabledRecipientIds = (prefsList || [])
        .filter((p) => p.group_notifications_enabled !== false)
        .map((p) => p.user_id)
        .filter(Boolean) as string[];

      if (enabledRecipientIds.length === 0) return;

      await Promise.allSettled(
        enabledRecipientIds.map((to) =>
          this.novu.trigger({
            workflowId: NOTIFICATION_WORKFLOWS.GROUP_ACHIEVEMENT_UNLOCKED,
            to,
            payload,
          }),
        ),
      );
    } catch (error) {
      console.error("Error sending group achievement notification:", error);
    }
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
      const prefs = await this.getUserNotificationPreferences(adminId);

      // Skip if admin has disabled group join notifications
      if (prefs && !prefs.group_join_enabled) {
        return;
      }

      // Prepare notification payload
      const joinerName = newMember.username ?? newMember.full_name ?? "Someone";
      const joinerAvatar = newMember.avatar_url || "";

      const payload = {
        joinerName,
        groupName: group.name,
        joinerAvatar,
        groupId,
      };

      // Trigger Novu workflow
      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.GROUP_JOIN,
        to: adminId,
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
    festivalId: string,
  ): Promise<void> {
    try {
      if (groupIds.length === 0) {
        return;
      }

      // Get user info
      const { data: user, error: userError } = await this.supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        console.error("Error fetching user for tent checkin:", userError);
        return;
      }

      // Get all group members (excluding the user who checked in) for this festival
      const { data: groupMembers, error: membersError } = await this.supabase
        .from("group_members")
        .select(
          `
          user_id,
          group_id,
          groups!inner(name, festival_id)
        `,
        )
        .in("group_id", groupIds)
        .eq("groups.festival_id", festivalId)
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

      // Query for members with checkin notifications enabled
      const { data: membersToNotify, error: prefsError } = await this.supabase
        .from("user_notification_preferences")
        .select("user_id, checkin_enabled, push_enabled")
        .in("user_id", memberIds)
        .eq("checkin_enabled", true);

      if (prefsError) {
        console.error("Error fetching member preferences:", prefsError);
        return;
      }

      if (!membersToNotify || membersToNotify.length === 0) {
        return;
      }

      const userName = user.username || user.full_name || "Someone";
      const userAvatar = user.avatar_url || "";

      // Send notifications to all eligible members with their specific group context
      const notificationPromises = membersToNotify.map((member) => {
        // Find groups this specific member shares with the check-in user
        const memberGroups = groupMembers
          .filter((gm) => gm.user_id === member.user_id)

          .map((gm) => (gm.groups as any)?.name)
          .filter(Boolean);

        const groupNamesText =
          memberGroups.length > 0 ? memberGroups.join(", ") : "Group";

        return this.novu.trigger({
          workflowId: NOTIFICATION_WORKFLOWS.TENT_CHECKIN,
          to: member.user_id!,
          payload: {
            userName,
            tentName,
            groupName: groupNamesText,
            userAvatar,
          },
        });
      });

      await Promise.allSettled(notificationPromises);
    } catch (error) {
      console.error("Error sending tent checkin notifications:", error);
    }
  }
}
