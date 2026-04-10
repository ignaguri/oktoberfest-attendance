import { Novu } from "@novu/api";
import { ChatOrPushProviderEnum } from "@novu/api/models/components";
import type { Database } from "@prostcounter/db";
import type { UpdateNotificationPreferencesInput } from "@prostcounter/shared";
import {
  DEFAULT_AVATAR_URL,
  NOTIFICATION_WORKFLOWS,
} from "@prostcounter/shared/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../lib/logger";

type NotificationPreferences =
  Database["public"]["Tables"]["user_notification_preferences"]["Row"];

/**
 * Notification Service
 * Handles notification triggering, FCM token management, and user preferences
 */
export class NotificationService {
  private novu: Novu;
  private expoIntegrationId: string | undefined;
  private fcmIntegrationId: string | undefined;

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
    this.expoIntegrationId = process.env.NOVU_EXPO_INTEGRATION_ID;
    this.fcmIntegrationId = process.env.NOVU_FCM_INTEGRATION_ID;
  }

  /**
   * Register FCM device token with Novu subscriber
   * @deprecated Use registerExpoPushToken for Expo apps
   */
  async registerFCMToken(userId: string, token: string): Promise<boolean> {
    if (!this.fcmIntegrationId) {
      logger.error(
        "NOVU_FCM_INTEGRATION_ID is not set; refusing to register FCM token",
      );
      return false;
    }
    try {
      await this.novu.subscribers.credentials.update(
        {
          providerId: ChatOrPushProviderEnum.Fcm,
          integrationIdentifier: this.fcmIntegrationId,
          credentials: {
            deviceTokens: [token],
          },
        },
        userId,
      );
      logger.info(
        {
          userId,
          tokenPrefix: token.substring(0, 20),
          integrationIdentifier: this.fcmIntegrationId,
        },
        "FCM token attached to Novu subscriber",
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
    if (!this.expoIntegrationId) {
      const msg =
        "NOVU_EXPO_INTEGRATION_ID is not set; refusing to register Expo push token";
      logger.error(msg);
      return { success: false, novuRegistered: false, error: msg };
    }
    try {
      await this.novu.subscribers.credentials.update(
        {
          providerId: ChatOrPushProviderEnum.Expo,
          integrationIdentifier: this.expoIntegrationId,
          credentials: {
            deviceTokens: [token],
          },
        },
        userId,
      );
      logger.info(
        {
          userId,
          tokenPrefix: token.substring(0, 30),
          integrationIdentifier: this.expoIntegrationId,
        },
        "Expo push token attached to Novu subscriber",
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
      // Build payload with only defined values
      // Novu SDK rejects undefined values, so we must omit them
      const payload: Record<string, unknown> = {
        subscriberId: userId,
      };
      if (userEmail !== undefined) payload.email = userEmail;
      if (firstName !== undefined) payload.firstName = firstName;
      if (lastName !== undefined) payload.lastName = lastName;
      if (avatar !== undefined) payload.avatar = avatar;

      logger.info(payload, "About to call Novu subscribers.create");
      const result = await this.novu.subscribers.create(
        payload as {
          subscriberId: string;
          email?: string;
          firstName?: string;
          lastName?: string;
          avatar?: string;
        },
      );
      logger.info({ result }, "Novu subscriber create SUCCESS");
      return { success: true };
    } catch (error) {
      logger.error(
        {
          error,
          errorString: String(error),
          errorJSON: JSON.stringify(error, null, 2),
        },
        "Novu subscriber create FAILED",
      );

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
        // Subscriber exists — actively update so profile fields stay fresh.
        // We don't want to rely on "create updates on conflict" — some SDK
        // versions throw 409 without applying the update.
        try {
          const updatePayload: Record<string, unknown> = {};
          if (userEmail !== undefined) updatePayload.email = userEmail;
          if (firstName !== undefined) updatePayload.firstName = firstName;
          if (lastName !== undefined) updatePayload.lastName = lastName;
          if (avatar !== undefined) updatePayload.avatar = avatar;

          if (Object.keys(updatePayload).length > 0) {
            await this.novu.subscribers.patch(
              updatePayload as {
                email?: string;
                firstName?: string;
                lastName?: string;
                avatar?: string;
              },
              userId,
            );
            logger.info(
              { userId },
              "Novu subscriber already existed — updated profile",
            );
          } else {
            logger.debug(
              { userId },
              "Novu subscriber already existed — nothing to update",
            );
          }
          return { success: true };
        } catch (updateError) {
          logger.error(
            { updateError, userId },
            "Failed to update existing Novu subscriber after 409",
          );
          // Still return success — the subscriber exists and can receive
          // notifications. Credential update (the actual push path) will be
          // attempted next and is the real signal.
          return { success: true };
        }
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
   * Atomic push enable: ensure subscriber exists AND attach push token in
   * one server-side operation. The client used to call subscribe then
   * registerToken separately, which left room for partial state (subscriber
   * created but no token attached). Callers should prefer this method.
   */
  async subscribeAndRegisterToken(
    userId: string,
    token: string,
    profile?: {
      email?: string;
      firstName?: string;
      lastName?: string;
      avatar?: string;
    },
  ): Promise<{
    success: boolean;
    novuRegistered: boolean;
    error?: string;
  }> {
    const subscribeResult = await this.subscribeUser(
      userId,
      profile?.email,
      profile?.firstName,
      profile?.lastName,
      profile?.avatar,
    );

    if (!subscribeResult.success) {
      return {
        success: false,
        novuRegistered: false,
        error: subscribeResult.error ?? "Failed to subscribe user",
      };
    }

    return this.registerPushToken(userId, token);
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
          daily_reminder_enabled: preferences.dailyReminderEnabled,
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
   * Notify group members when someone starts sharing their location
   * (respects checkin_enabled preference since it's similar to location tracking)
   */
  async notifyLocationSharingStarted(
    userId: string,
    festivalId: string,
    groupIds?: string[],
  ): Promise<void> {
    try {
      // Get user info
      const { data: user, error: userError } = await this.supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        logger.error(
          { error: userError },
          "Error fetching user for location sharing notification",
        );
        return;
      }

      // If no specific groupIds provided, get all user's groups for this festival
      let targetGroupIds: string[] = groupIds || [];
      if (targetGroupIds.length === 0) {
        const { data: userGroups, error: groupsError } = await this.supabase
          .from("group_members")
          .select("group_id, groups!inner(festival_id)")
          .eq("user_id", userId)
          .eq("groups.festival_id", festivalId);

        if (groupsError) {
          logger.error({ error: groupsError }, "Error fetching user groups");
          return;
        }

        targetGroupIds =
          userGroups
            ?.map((g) => g.group_id)
            .filter((id): id is string => id !== null) || [];
      }

      if (targetGroupIds.length === 0) {
        return;
      }

      // Get all group members (excluding the user who started sharing)
      const { data: groupMembers, error: membersError } = await this.supabase
        .from("group_members")
        .select(
          `
          user_id,
          group_id,
          groups!inner(name, festival_id)
        `,
        )
        .in("group_id", targetGroupIds)
        .eq("groups.festival_id", festivalId)
        .neq("user_id", userId);

      if (membersError) {
        logger.error({ error: membersError }, "Error fetching group members");
        return;
      }

      if (!groupMembers || groupMembers.length === 0) {
        return;
      }

      // Get notification preferences for these members (checkin_enabled)
      const memberIds = [
        ...new Set(groupMembers.map((member) => member.user_id)),
      ];

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

      const sharerName = user.username || user.full_name || "Someone";
      const sharerAvatar = user.avatar_url || DEFAULT_AVATAR_URL;

      // Send notifications to all eligible members
      const notificationPromises = membersToNotify.map((member) => {
        // Find groups this specific member shares with the sharing user
        const memberGroupsData = groupMembers
          .filter((gm) => gm.user_id === member.user_id)
          .map((gm) => ({
            name: (gm.groups as { name: string })?.name,
            id: gm.group_id,
          }))
          .filter((g) => g.name);

        const groupNamesText =
          memberGroupsData.length > 0
            ? memberGroupsData.map((g) => g.name).join(", ")
            : "Group";
        const firstGroupId = memberGroupsData[0]?.id || "";

        return this.novu.trigger({
          workflowId: NOTIFICATION_WORKFLOWS.LOCATION_SHARING,
          to: member.user_id!,
          payload: {
            sharerName,
            groupName: groupNamesText,
            sharerAvatar,
            groupId: firstGroupId,
            action: "started" as const,
          },
        });
      });

      await Promise.allSettled(notificationPromises);
    } catch (error) {
      logger.error({ error }, "Error sending location sharing notifications");
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
      const joinerAvatar = newMember.avatar_url || DEFAULT_AVATAR_URL;

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
   * Notify a user when they receive a friend request
   * (respects push_enabled preference)
   */
  async notifyFriendRequest(
    requesterId: string,
    addresseeId: string,
  ): Promise<void> {
    try {
      // Get requester's profile info
      const { data: requester, error: requesterError } = await this.supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", requesterId)
        .single();

      if (requesterError || !requester) {
        logger.error(
          { error: requesterError },
          "Error fetching requester profile for friend request notification",
        );
        return;
      }

      // Check addressee's notification preferences
      const prefs = await this.getUserNotificationPreferences(addresseeId);

      if (prefs && prefs.push_enabled === false) {
        return;
      }

      const requesterName =
        requester.username || requester.full_name || "Someone";
      const requesterAvatar = requester.avatar_url || DEFAULT_AVATAR_URL;

      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.FRIEND_REQUEST,
        to: addresseeId,
        payload: {
          requesterName,
          requesterAvatar,
          requesterId,
        },
      });
    } catch (error) {
      logger.error({ error }, "Error sending friend request notification");
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
      const userAvatar = user.avatar_url || DEFAULT_AVATAR_URL;

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
