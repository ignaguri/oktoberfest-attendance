import { Novu } from "@novu/api";
import { ChatOrPushProviderEnum } from "@novu/api/models/components";
import type { Database } from "@prostcounter/db";
import type { UpdateNotificationPreferencesInput } from "@prostcounter/shared";
import {
  DEFAULT_AVATAR_URL,
  NOTIFICATION_WORKFLOWS,
} from "@prostcounter/shared/constants";
import { runNovuWriteTolerantly } from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../lib/logger";

type NotificationPreferences =
  Database["public"]["Tables"]["user_notification_preferences"]["Row"];

type SubscriberProfile = {
  email?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
};

function isConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    statusCode?: number;
    status?: number;
    code?: number;
    message?: string;
  };
  const status = e.statusCode ?? e.status ?? e.code;
  if (status === 409) return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("409") || message.toLowerCase().includes("already exists")
  );
}

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

  private requireExpoIntegrationId(): string {
    if (!this.expoIntegrationId) {
      throw new Error(
        "NOVU_EXPO_INTEGRATION_ID is not set; refusing to register Expo push token",
      );
    }
    return this.expoIntegrationId;
  }

  private requireFcmIntegrationId(): string {
    if (!this.fcmIntegrationId) {
      throw new Error(
        "NOVU_FCM_INTEGRATION_ID is not set; refusing to register FCM token",
      );
    }
    return this.fcmIntegrationId;
  }

  /**
   * Register FCM device token with Novu subscriber
   * @deprecated Use registerExpoPushToken for Expo apps
   */
  async registerFCMToken(userId: string, token: string): Promise<boolean> {
    try {
      const integrationIdentifier = this.requireFcmIntegrationId();
      await runNovuWriteTolerantly(
        () =>
          this.novu.subscribers.credentials.update(
            {
              providerId: ChatOrPushProviderEnum.Fcm,
              integrationIdentifier,
              credentials: { deviceTokens: [token] },
            },
            userId,
          ),
        () =>
          logger.warn(
            { userId },
            "Novu SDK ResponseValidationError on FCM register — treating as success",
          ),
      );
      logger.info(
        { userId, tokenPrefix: token.substring(0, 20) },
        "FCM token attached to Novu subscriber",
      );
      return true;
    } catch (error) {
      logger.error({ error, userId }, "Error registering FCM token");
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
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const integrationIdentifier = this.requireExpoIntegrationId();
      await runNovuWriteTolerantly(
        () =>
          this.novu.subscribers.credentials.update(
            {
              providerId: ChatOrPushProviderEnum.Expo,
              integrationIdentifier,
              credentials: { deviceTokens: [token] },
            },
            userId,
          ),
        () =>
          logger.warn(
            { userId, tokenPrefix: token.substring(0, 30) },
            "Novu SDK ResponseValidationError on Expo register — treating as success",
          ),
      );
      logger.info(
        { userId, tokenPrefix: token.substring(0, 30) },
        "Expo push token attached to Novu subscriber",
      );
      return { success: true };
    } catch (error) {
      logger.error({ error, userId }, "Error registering Expo push token");
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to register push token";
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Register push token - auto-detects token type (Expo or FCM)
   */
  async registerPushToken(
    userId: string,
    token: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Expo push tokens start with "ExponentPushToken["
    if (token.startsWith("ExponentPushToken[")) {
      return this.registerExpoPushToken(userId, token);
    }
    const fcmResult = await this.registerFCMToken(userId, token);
    return {
      success: fcmResult,
      error: fcmResult ? undefined : "Failed to register FCM token",
    };
  }

  /**
   * Subscribe user to Novu. Handles existing subscribers (409 Conflict) by
   * actively patching them — we don't rely on "create updates on conflict"
   * because some SDK versions throw 409 without applying the update.
   */
  async subscribeUser(
    userId: string,
    profile?: SubscriberProfile,
  ): Promise<{ success: boolean; error?: string }> {
    const payload: Record<string, unknown> = { subscriberId: userId };
    if (profile?.email !== undefined) payload.email = profile.email;
    if (profile?.firstName !== undefined) payload.firstName = profile.firstName;
    if (profile?.lastName !== undefined) payload.lastName = profile.lastName;
    if (profile?.avatar !== undefined) payload.avatar = profile.avatar;

    try {
      await runNovuWriteTolerantly(
        () =>
          this.novu.subscribers.create(
            payload as {
              subscriberId: string;
              email?: string;
              firstName?: string;
              lastName?: string;
              avatar?: string;
            },
          ),
        () =>
          logger.warn(
            { userId },
            "Novu SDK ResponseValidationError on subscriber create — treating as success",
          ),
      );
      logger.info({ userId }, "Novu subscriber create SUCCESS");
      return { success: true };
    } catch (error) {
      if (isConflictError(error)) {
        return this.patchExistingSubscriber(userId, profile);
      }
      logger.error({ error, userId }, "Novu subscriber create FAILED");
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async patchExistingSubscriber(
    userId: string,
    profile?: SubscriberProfile,
  ): Promise<{ success: boolean }> {
    const updatePayload: Record<string, unknown> = {};
    if (profile?.email !== undefined) updatePayload.email = profile.email;
    if (profile?.firstName !== undefined)
      updatePayload.firstName = profile.firstName;
    if (profile?.lastName !== undefined)
      updatePayload.lastName = profile.lastName;
    if (profile?.avatar !== undefined) updatePayload.avatar = profile.avatar;

    if (Object.keys(updatePayload).length === 0) {
      return { success: true };
    }

    try {
      await runNovuWriteTolerantly(
        () =>
          this.novu.subscribers.patch(
            updatePayload as {
              email?: string;
              firstName?: string;
              lastName?: string;
              avatar?: string;
            },
            userId,
          ),
        () =>
          logger.warn(
            { userId },
            "Novu SDK ResponseValidationError on subscriber patch — treating as success",
          ),
      );
      logger.info(
        { userId },
        "Novu subscriber already existed — updated profile",
      );
    } catch (updateError) {
      // Subscriber exists and can receive notifications even if the profile
      // patch failed. Credential update (the push path) is the real signal.
      logger.error(
        { updateError, userId },
        "Failed to update existing Novu subscriber after 409",
      );
    }
    return { success: true };
  }

  /**
   * Atomic push enable: ensure subscriber exists AND attach push token in
   * one server-side operation.
   */
  async subscribeAndRegisterToken(
    userId: string,
    token: string,
    profile?: SubscriberProfile,
  ): Promise<{ success: boolean; error?: string }> {
    const subscribeResult = await this.subscribeUser(userId, profile);
    if (!subscribeResult.success) {
      return {
        success: false,
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
