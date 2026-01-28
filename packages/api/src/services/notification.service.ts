import { Novu } from "@novu/api";
import { ChatOrPushProviderEnum } from "@novu/api/models/components";
import type { Database } from "@prostcounter/db";
import type { UpdateNotificationPreferencesInput } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../lib/logger";

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
   * @deprecated Use registerExpoPushToken for Expo apps
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
      logger.error({ error }, "Error registering FCM token");
      return false;
    }
  }

  /**
   * Register Expo push token with Novu subscriber
   * Expo push tokens look like: ExponentPushToken[xxxxx]
   */
  async registerExpoPushToken(
    userId: string,
    token: string,
  ): Promise<{ success: boolean; novuRegistered: boolean; error?: string }> {
    try {
      await this.novu.subscribers.credentials.update(
        {
          providerId: ChatOrPushProviderEnum.Expo,
          credentials: {
            deviceTokens: [token],
          },
        },
        userId,
      );
      return { success: true, novuRegistered: true };
    } catch (error) {
      logger.error({ error }, "Error registering Expo push token");
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to register push token";
      return { success: false, novuRegistered: false, error: errorMessage };
    }
  }

  /**
   * Register push token - auto-detects token type (Expo or FCM)
   * Returns detailed result including whether Novu registration succeeded
   */
  async registerPushToken(
    userId: string,
    token: string,
  ): Promise<{ success: boolean; novuRegistered: boolean; error?: string }> {
    // Expo push tokens start with "ExponentPushToken["
    if (token.startsWith("ExponentPushToken[")) {
      return this.registerExpoPushToken(userId, token);
    }
    // Fallback to FCM for other token formats
    const fcmResult = await this.registerFCMToken(userId, token);
    return {
      success: fcmResult,
      novuRegistered: fcmResult,
      error: fcmResult ? undefined : "Failed to register FCM token",
    };
  }

  /**
   * Subscribe user to Novu notifications with full profile data
   * Handles existing subscribers (409 Conflict) by updating instead
   */
  async subscribeUser(
    userId: string,
    userEmail?: string,
    firstName?: string,
    lastName?: string,
    avatar?: string,
  ): Promise<{ success: boolean; error?: string }> {
    logger.debug(
      {
        userId,
        userEmail,
        firstName,
        lastName,
        avatar: avatar ? "present" : "null",
      },
      "subscribeUser called",
    );

    try {
      const result = await this.novu.subscribers.create({
        subscriberId: userId,
        email: userEmail,
        firstName,
        lastName,
        avatar,
      });
      logger.debug({ result }, "Novu subscriber create result");
      return { success: true };
    } catch (error) {
      logger.error({ error }, "Error subscribing user");

      // Check if it's a 409 Conflict (subscriber already exists)
      // First check for status code property (Novu SDK may include this)
      const errorObj = error as {
        statusCode?: number;
        status?: number;
        code?: number;
        message?: string;
      };
      const statusCode =
        errorObj.statusCode ?? errorObj.status ?? errorObj.code;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check for 409 status code first, then fall back to message matching
      const is409 =
        statusCode === 409 ||
        errorMessage.includes("409") ||
        errorMessage.toLowerCase().includes("already exists");

      if (is409) {
        // According to Novu SDK, calling create on an existing subscriber updates it
        // But some versions may throw 409. In that case, we consider it a success
        // since the subscriber already exists and can receive notifications
        logger.debug("Subscriber already exists - treating as success");
        return { success: true };
      }

      // Log full error details for non-409 errors
      if (error instanceof Error) {
        logger.error(
          {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
          },
          "Error details",
        );
      }
      return { success: false, error: errorMessage };
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
      logger.error({ error }, "Error fetching notification preferences");
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
      logger.error({ error }, "Error updating notification preferences");
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
      logger.error({ error }, "Error sending reservation reminder");
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
      logger.error({ error }, "Error sending reservation prompt");
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
      logger.error({ error }, "Error sending achievement notification");
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
        logger.error(
          {
            error,
          },
          "Error fetching preferences for group achievement",
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
      logger.error({ error }, "Error sending group achievement notification");
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
      logger.error({ error }, "Error sending group join notification");
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
        logger.error(
          { error: userError },
          "Error fetching user for tent checkin",
        );
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
        logger.error({ error: membersError }, "Error fetching group members");
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
        logger.error(
          { error: prefsError },
          "Error fetching member preferences",
        );
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
      logger.error({ error }, "Error sending tent checkin notifications");
    }
  }
}
