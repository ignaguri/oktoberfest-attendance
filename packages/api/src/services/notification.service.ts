import { Novu } from "@novu/api";
import { ChatOrPushProviderEnum } from "@novu/api/models/components";
import type { Database } from "@prostcounter/db";
import type { DayPlanKind, UpdateNotificationPreferencesInput } from "@prostcounter/shared";
import {
  DEFAULT_AVATAR_URL,
  NOTIFICATION_PUSH_TYPES,
  NOTIFICATION_WORKFLOWS,
} from "@prostcounter/shared/constants";
import {
  createGetAvatarUrl,
  formatDateForDatabase,
  runNovuWriteTolerantly,
} from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../lib/logger";
import { SupabaseAttendanceRepository } from "../repositories/supabase/attendance.repository";
import { createAdminClient } from "../utils/admin-client";
import { buildOverlapBody, formatOverlapDayLabel } from "./plan-overlap-copy";

// Yesterday still counts as the day starting until 01:00 festival-time.
const DAY_START_GRACE_MS = 60 * 60 * 1000;

type NotificationPreferences = Database["public"]["Tables"]["user_notification_preferences"]["Row"];

type SubscriberProfile = {
  email?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
};

/**
 * Profiles store only the avatar filename; clients build the URL themselves.
 * Novu's in-app step validates its avatar control as a URI, so handing it a
 * bare filename fails the entire step with ExecutionStateOutputInvalidError
 * and no notification is delivered at all. Resolve it to a public storage URL
 * before it goes into a trigger payload.
 */
export function resolveAvatarUrl(avatarUrl: string | null | undefined): string {
  const supabaseUrl = process.env.SUPABASE_PUBLIC_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const getAvatarUrl = createGetAvatarUrl({ strategy: "direct-storage", supabaseUrl });
  const resolved = getAvatarUrl(avatarUrl);

  // With neither env var set the builder produces a relative
  // "/storage/v1/..." path. That is truthy, so a plain falsy check would let
  // it through to fail inside Novu instead, which is the failure this
  // function exists to prevent. Only an absolute URL counts as resolved.
  return resolved?.startsWith("http") ? resolved : DEFAULT_AVATAR_URL;
}

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
  return message.includes("409") || message.toLowerCase().includes("already exists");
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
      throw new Error("NOVU_EXPO_INTEGRATION_ID is not set; refusing to register Expo push token");
    }
    return this.expoIntegrationId;
  }

  private requireFcmIntegrationId(): string {
    if (!this.fcmIntegrationId) {
      throw new Error("NOVU_FCM_INTEGRATION_ID is not set; refusing to register FCM token");
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
      const errorMessage = error instanceof Error ? error.message : "Failed to register push token";
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
    if (profile?.firstName !== undefined) updatePayload.firstName = profile.firstName;
    if (profile?.lastName !== undefined) updatePayload.lastName = profile.lastName;
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
      logger.info({ userId }, "Novu subscriber already existed — updated profile");
    } catch (updateError) {
      // Subscriber exists and can receive notifications even if the profile
      // patch failed. Credential update (the push path) is the real signal.
      logger.error({ updateError, userId }, "Failed to update existing Novu subscriber after 409");
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
  async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
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
   * Narrow a recipient list to those who have not switched `column` off.
   *
   * Always reads through the admin client. The only SELECT policy on
   * user_notification_preferences is `auth.uid() = user_id`, so the
   * request-scoped client returns zero rows for anybody but the caller, with no
   * error, and a fan-out that filters on those rows silently drops every
   * recipient. Returns null when preferences cannot be read at all, so callers
   * can skip sending rather than notify people who opted out.
   *
   * A recipient with no row counts as opted in: every toggle on the table
   * defaults to true, and accounts predating the default-preferences trigger
   * have no row at all.
   */
  private async filterByPreference(
    recipientIds: string[],
    column:
      | "group_notifications_enabled"
      | "group_join_enabled"
      | "checkin_enabled"
      | "friend_plans_enabled"
      | "day_start_enabled",
  ): Promise<string[] | null> {
    if (recipientIds.length === 0) {
      return [];
    }

    let prefsClient;
    try {
      prefsClient = createAdminClient();
    } catch (adminError) {
      logger.error(
        { error: adminError, column },
        "Admin client unavailable; skipping notifications rather than ignoring recipient preferences",
      );
      return null;
    }

    const { data, error } = await prefsClient
      .from("user_notification_preferences")
      .select(
        "user_id, group_notifications_enabled, group_join_enabled, checkin_enabled, friend_plans_enabled, day_start_enabled",
      )
      .in("user_id", recipientIds);

    if (error) {
      logger.error({ error, column }, "Error fetching recipient notification preferences");
      return null;
    }

    const disabled = new Set(
      (data ?? []).filter((row) => row[column] === false).map((row) => row.user_id),
    );

    return recipientIds.filter((id) => !disabled.has(id));
  }

  /**
   * Update user's notification preferences
   */
  async updateUserNotificationPreferences(
    userId: string,
    preferences: UpdateNotificationPreferencesInput,
  ): Promise<boolean> {
    const { error } = await this.supabase.from("user_notification_preferences").upsert(
      {
        user_id: userId,
        push_enabled: preferences.pushEnabled,
        group_join_enabled: preferences.groupJoinEnabled,
        checkin_enabled: preferences.checkinEnabled,
        reminders_enabled: preferences.remindersEnabled,
        achievement_notifications_enabled: preferences.achievementNotificationsEnabled,
        group_notifications_enabled: preferences.groupNotificationsEnabled,
        daily_reminder_enabled: preferences.dailyReminderEnabled,
        friend_plans_enabled: preferences.friendPlansEnabled,
        day_start_enabled: preferences.dayStartEnabled,
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
   *
   * Returns false when the trigger failed. Novu rejects a payload that does not
   * match the workflow schema, and that rejection is caught here, so callers
   * that record "already notified" must key off this instead of assuming the
   * absence of a throw means delivery. Opting out via reminders_enabled returns
   * true: nothing was sent, but there is nothing to retry either.
   */
  async notifyReservationReminder(
    userId: string,
    payload: {
      reservationId: string;
      tentName: string;
      startAtISO: string;
      festivalName?: string;
    },
  ): Promise<boolean> {
    try {
      const prefs = await this.getUserNotificationPreferences(userId);

      if (prefs && prefs.reminders_enabled === false) {
        return true;
      }

      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.RESERVATION_REMINDER,
        to: userId,
        payload,
      });

      return true;
    } catch (error) {
      logger.error({ error }, "Error sending reservation reminder");
      return false;
    }
  }

  /**
   * Send reservation check-in prompt to a user at reservation start time
   * (respects reminders_enabled)
   *
   * Returns false on failure, for the same reason as notifyReservationReminder.
   */
  async notifyReservationPrompt(
    userId: string,
    payload: {
      reservationId: string;
      tentName: string;
      deepLinkUrl: string;
    },
  ): Promise<boolean> {
    try {
      const prefs = await this.getUserNotificationPreferences(userId);

      if (prefs && prefs.reminders_enabled === false) {
        return true;
      }

      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.RESERVATION_CHECKIN_PROMPT,
        to: userId,
        payload,
      });

      return true;
    } catch (error) {
      logger.error({ error }, "Error sending reservation prompt");
      return false;
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
      tier: 1 | 2 | 3 | 4;
      slug: string;
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
        payload: {
          achievementName: payload.achievementName,
          description: payload.description ?? "",
          tier: payload.tier,
          slug: payload.slug,
        },
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
      tier: 3 | 4;
      groupName?: string;
    },
  ): Promise<void> {
    try {
      if (recipientIds.length === 0) return;

      const enabledRecipientIds = await this.filterByPreference(
        recipientIds,
        "group_notifications_enabled",
      );

      if (!enabledRecipientIds || enabledRecipientIds.length === 0) return;

      const results = await Promise.allSettled(
        enabledRecipientIds.map((to) =>
          this.novu.trigger({
            workflowId: NOTIFICATION_WORKFLOWS.GROUP_ACHIEVEMENT_UNLOCKED,
            to,
            payload: {
              achieverName: payload.achieverName,
              achievementName: payload.achievementName,
              tier: payload.tier,
              groupName: payload.groupName,
            },
          }),
        ),
      );

      // allSettled hides rejections, so surface them: a trigger that fails
      // here is otherwise indistinguishable from one that was never sent.
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        logger.error(
          {
            failed: failures.length,
            total: results.length,
            reasons: failures.map((f) => String((f as PromiseRejectedResult).reason)),
          },
          "Some group achievement notifications failed to send",
        );
      }
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
        logger.error({ error: userError }, "Error fetching user for location sharing notification");
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
          userGroups?.map((g) => g.group_id).filter((id): id is string => id !== null) || [];
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

      const memberIds = [
        ...new Set(groupMembers.map((member) => member.user_id).filter((id) => id !== null)),
      ];

      const membersToNotify = await this.filterByPreference(memberIds, "checkin_enabled");

      if (!membersToNotify || membersToNotify.length === 0) {
        return;
      }

      const sharerName = user.username || user.full_name || "Someone";
      const sharerAvatar = resolveAvatarUrl(user.avatar_url);

      // Send notifications to all eligible members
      const notificationPromises = membersToNotify.map((memberId) => {
        // Find groups this specific member shares with the sharing user
        const memberGroupsData = groupMembers
          .filter((gm) => gm.user_id === memberId)
          .map((gm) => ({
            name: (gm.groups as { name: string })?.name,
            id: gm.group_id,
          }))
          .filter((g) => g.name);

        const groupNamesText =
          memberGroupsData.length > 0 ? memberGroupsData.map((g) => g.name).join(", ") : "Group";
        const firstGroupId = memberGroupsData[0]?.id || "";

        return this.novu.trigger({
          workflowId: NOTIFICATION_WORKFLOWS.LOCATION_SHARING,
          to: memberId,
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

      // The admin is not the caller, so their preferences are unreadable through
      // the request-scoped client that getUserNotificationPreferences uses: it
      // returned null every time and the `prefs &&` guard read that as "send
      // anyway", which meant group_join_enabled was never actually honoured.
      const enabled = await this.filterByPreference([adminId], "group_join_enabled");
      if (!enabled || enabled.length === 0) {
        return;
      }

      // Prepare notification payload
      const joinerName = newMember.username ?? newMember.full_name ?? "Someone";
      const joinerAvatar = resolveAvatarUrl(newMember.avatar_url);

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
   * Notify the members of a past-festival group that it has been carried over
   * Fans out to everyone except the creator, who triggered it
   */
  async notifyGroupCarryOver(
    recipientIds: string[],
    payload: {
      groupName: string;
      festivalName: string;
      inviteToken: string;
      groupId: string;
    },
  ): Promise<void> {
    try {
      if (recipientIds.length === 0) {
        return;
      }

      const enabledRecipientIds = await this.filterByPreference(
        recipientIds,
        "group_notifications_enabled",
      );

      if (!enabledRecipientIds || enabledRecipientIds.length === 0) {
        return;
      }

      const results = await Promise.allSettled(
        enabledRecipientIds.map((to) =>
          this.novu.trigger({
            workflowId: NOTIFICATION_WORKFLOWS.GROUP_CARRY_OVER,
            to,
            payload,
          }),
        ),
      );

      // allSettled hides rejections, so surface them: a trigger that fails here
      // is otherwise indistinguishable from one that was never sent.
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        logger.error(
          {
            failed: failures.length,
            total: results.length,
            reasons: failures.map((f) => String((f as PromiseRejectedResult).reason)),
          },
          "Some group carry-over notifications failed to send",
        );
      }
    } catch (error) {
      logger.error({ error }, "Error sending group carry-over notification");
    }
  }

  /**
   * Notify a user when they receive a friend request
   * (respects push_enabled preference)
   */
  async notifyFriendRequest(requesterId: string, addresseeId: string): Promise<void> {
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

      const requesterName = requester.username || requester.full_name || "Someone";
      const requesterAvatar = resolveAvatarUrl(requester.avatar_url);

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
   * Tell a group's creator that someone asked to join
   * (respects group_join_enabled; a missing preference row counts as opted in)
   */
  async notifyJoinRequest(input: { requesterId: string; groupId: string }): Promise<void> {
    try {
      // The caller is not a member yet, so read the group with the admin client
      const adminClient = createAdminClient();
      const { data: group, error: groupError } = await adminClient
        .from("groups")
        .select("name, created_by")
        .eq("id", input.groupId)
        .single();

      if (groupError || !group?.created_by) {
        logger.error({ error: groupError }, "Error fetching group for join request notification");
        return;
      }

      const recipients = await this.filterByPreference([group.created_by], "group_join_enabled");
      if (!recipients || recipients.length === 0) {
        return;
      }

      const { data: requester } = await this.supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", input.requesterId)
        .single();

      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.GROUP_JOIN_REQUEST,
        to: group.created_by,
        payload: {
          type: NOTIFICATION_PUSH_TYPES.GROUP_JOIN_REQUEST,
          requesterName: requester?.username || requester?.full_name || "Someone",
          requesterAvatar: resolveAvatarUrl(requester?.avatar_url),
          groupId: input.groupId,
          groupName: group.name,
        },
      });
    } catch (error) {
      logger.error({ error }, "Error sending group join request notification");
    }
  }

  /**
   * Tell a requester that the creator let them into the group
   * (respects group_join_enabled; a missing preference row counts as opted in)
   */
  async notifyJoinRequestAccepted(input: { requesterId: string; groupId: string }): Promise<void> {
    try {
      const recipients = await this.filterByPreference([input.requesterId], "group_join_enabled");
      if (!recipients || recipients.length === 0) {
        return;
      }

      const { data: group, error: groupError } = await this.supabase
        .from("groups")
        .select("name")
        .eq("id", input.groupId)
        .single();

      if (groupError || !group) {
        logger.error({ error: groupError }, "Error fetching group for join accepted notification");
        return;
      }

      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.GROUP_JOIN_REQUEST_ACCEPTED,
        to: input.requesterId,
        payload: {
          type: NOTIFICATION_PUSH_TYPES.GROUP_JOIN_REQUEST_ACCEPTED,
          groupId: input.groupId,
          groupName: group.name,
        },
      });
    } catch (error) {
      logger.error({ error }, "Error sending group join accepted notification");
    }
  }

  /**
   * Tell someone a group's creator invited them
   * (respects group_join_enabled; a missing preference row counts as opted in)
   */
  async notifyGroupInvitation(input: {
    inviterId: string;
    inviteeId: string;
    groupId: string;
  }): Promise<void> {
    try {
      const recipients = await this.filterByPreference([input.inviteeId], "group_join_enabled");
      if (!recipients || recipients.length === 0) {
        return;
      }

      const { data: group, error: groupError } = await this.supabase
        .from("groups")
        .select("name")
        .eq("id", input.groupId)
        .single();

      if (groupError || !group) {
        logger.error({ error: groupError }, "Error fetching group for invitation notification");
        return;
      }

      const { data: inviter } = await this.supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", input.inviterId)
        .single();

      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.GROUP_INVITATION,
        to: input.inviteeId,
        payload: {
          type: NOTIFICATION_PUSH_TYPES.GROUP_INVITATION,
          inviterName: inviter?.username || inviter?.full_name || "Someone",
          inviterAvatar: resolveAvatarUrl(inviter?.avatar_url),
          groupId: input.groupId,
          groupName: group.name,
        },
      });
    } catch (error) {
      logger.error({ error }, "Error sending group invitation notification");
    }
  }

  /**
   * Tell the creator that the person they invited joined
   * (respects group_join_enabled; a missing preference row counts as opted in)
   */
  async notifyGroupInvitationAccepted(input: {
    inviteeId: string;
    inviterId: string;
    groupId: string;
  }): Promise<void> {
    try {
      const recipients = await this.filterByPreference([input.inviterId], "group_join_enabled");
      if (!recipients || recipients.length === 0) {
        return;
      }

      const { data: group, error: groupError } = await this.supabase
        .from("groups")
        .select("name")
        .eq("id", input.groupId)
        .single();

      if (groupError || !group) {
        logger.error(
          { error: groupError },
          "Error fetching group for invitation accepted notification",
        );
        return;
      }

      const { data: invitee } = await this.supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", input.inviteeId)
        .single();

      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.GROUP_INVITATION_ACCEPTED,
        to: input.inviterId,
        payload: {
          type: NOTIFICATION_PUSH_TYPES.GROUP_INVITATION_ACCEPTED,
          inviteeName: invitee?.username || invitee?.full_name || "Someone",
          inviteeAvatar: resolveAvatarUrl(invitee?.avatar_url),
          groupId: input.groupId,
          groupName: group.name,
        },
      });
    } catch (error) {
      logger.error({ error }, "Error sending group invitation accepted notification");
    }
  }

  /**
   * Tell friends and group-mates who marked the same day that the actor is
   * going too.
   *
   * Only people who can already see the actor's plans are asked, and each
   * (recipient, actor, day) is notified at most once: the ledger insert is the
   * dedupe, so switching to "Not going" and back cannot notify anyone twice.
   */
  async notifyPlanOverlap(input: {
    actorId: string;
    festivalId: string;
    date: string;
    today: string;
    kind: DayPlanKind;
    tentName: string | null;
  }): Promise<void> {
    try {
      let adminClient;
      try {
        adminClient = createAdminClient();
      } catch (adminError) {
        logger.error(
          { error: adminError },
          "Admin client unavailable; skipping plan overlap notifications",
        );
        return;
      }

      const { data: recipientIds, error: recipientsError } = await adminClient.rpc(
        "get_day_plan_overlap_recipients",
        { p_actor_id: input.actorId, p_festival_id: input.festivalId, p_date: input.date },
      );

      if (recipientsError) {
        logger.error({ error: recipientsError }, "Error fetching plan overlap recipients");
        return;
      }
      if (!recipientIds || recipientIds.length === 0) {
        return;
      }

      const enabledRecipientIds = await this.filterByPreference(
        recipientIds,
        "friend_plans_enabled",
      );
      if (!enabledRecipientIds || enabledRecipientIds.length === 0) {
        return;
      }

      const { data: ledgerRows, error: ledgerError } = await adminClient
        .from("day_plan_overlap_notifications")
        .upsert(
          enabledRecipientIds.map((recipientId) => ({
            recipient_id: recipientId,
            actor_id: input.actorId,
            festival_id: input.festivalId,
            date: input.date,
          })),
          { onConflict: "recipient_id,actor_id,festival_id,date", ignoreDuplicates: true },
        )
        .select("recipient_id");

      if (ledgerError) {
        logger.error({ error: ledgerError }, "Error recording plan overlap notifications");
        return;
      }

      const newRecipientIds = (ledgerRows ?? []).map((row) => row.recipient_id);
      if (newRecipientIds.length === 0) {
        return;
      }

      const { data: actor } = await this.supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", input.actorId)
        .single();

      const actorName = actor?.username || actor?.full_name || "Someone";
      const payload = {
        type: NOTIFICATION_PUSH_TYPES.FRIEND_PLAN_OVERLAP,
        actorName,
        actorAvatar: resolveAvatarUrl(actor?.avatar_url),
        date: input.date,
        festivalId: input.festivalId,
        kind: input.kind,
        tentName: input.tentName ?? "",
        body: buildOverlapBody({
          actorName,
          kind: input.kind,
          tentName: input.tentName,
          dayLabel: formatOverlapDayLabel(input.date, input.today),
        }),
      };

      const results = await Promise.allSettled(
        newRecipientIds.map((to) =>
          this.novu.trigger({
            workflowId: NOTIFICATION_WORKFLOWS.FRIEND_PLAN_OVERLAP,
            to,
            payload,
          }),
        ),
      );

      const failedRecipientIds = newRecipientIds.filter(
        (_recipientId, index) => results[index].status === "rejected",
      );
      if (failedRecipientIds.length === 0) {
        return;
      }

      logger.error(
        {
          failedCount: failedRecipientIds.length,
          reason: results.find((result) => result.status === "rejected")?.reason,
        },
        "Error sending plan overlap notifications",
      );

      // A failed send must not count as notified, or that recipient never hears
      // about this actor and day again.
      const { error: forgetError } = await adminClient
        .from("day_plan_overlap_notifications")
        .delete()
        .eq("actor_id", input.actorId)
        .eq("festival_id", input.festivalId)
        .eq("date", input.date)
        .in("recipient_id", failedRecipientIds);

      if (forgetError) {
        logger.error({ error: forgetError }, "Error clearing failed plan overlap notifications");
      }
    } catch (error) {
      logger.error({ error }, "Error sending plan overlap notifications");
    }
  }

  /**
   * Announce that someone has started their festival day — their first drink or
   * first check-in, whichever landed first.
   *
   * The ledger insert is the claim. `ON CONFLICT DO NOTHING ... RETURNING`
   * hands a row only to the writer that won, so the four endpoints that can
   * produce a day's first action (POST /consumption, POST /attendance,
   * /attendance/personal, /attendance/tent-visits) collapse to one
   * notification, even when the mobile sync queue flushes a backlog and they
   * arrive at once.
   *
   * @returns true when this call claimed the day and sent the notification.
   *   false otherwise — including on error, so a caller falls back to the
   *   ordinary tent check-in rather than going silent.
   */
  async notifyDayStart(input: {
    actorId: string;
    festivalId: string;
    date: string;
    kind: "drink" | "checkin";
    tentName: string | null;
  }): Promise<boolean> {
    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch (adminError) {
      logger.error(
        { error: adminError },
        "Admin client unavailable; skipping day-start notification",
      );
      return false;
    }

    try {
      // Both clients let a user backfill a past date, and claiming the ledger
      // for one would announce a day that isn't starting. So only today
      // counts, in the festival's own timezone rather than the server's, with
      // yesterday allowed until 01:00: a visit near midnight can have its
      // offline-queue push land after the day has rolled over. Checking the
      // date an hour ago gives exactly that grace window.
      const attendanceRepo = new SupabaseAttendanceRepository(this.supabase);
      const timezone = await attendanceRepo.getFestivalTimezone(input.festivalId);
      const now = new Date();
      const todayInTz = formatDateForDatabase(now, timezone);
      const graceDateInTz = formatDateForDatabase(
        new Date(now.getTime() - DAY_START_GRACE_MS),
        timezone,
      );

      if (input.date !== todayInTz && input.date !== graceDateInTz) {
        logger.warn(
          {
            actorId: input.actorId,
            festivalId: input.festivalId,
            date: input.date,
            todayInTz,
            graceDateInTz,
          },
          "Day-start date outside today (plus 01:00 grace) window; skipping claim",
        );
        return false;
      }

      const { data: claimed, error: claimError } = await adminClient
        .from("day_start_notifications")
        .upsert(
          { actor_id: input.actorId, festival_id: input.festivalId, date: input.date },
          { onConflict: "actor_id,festival_id,date", ignoreDuplicates: true },
        )
        .select("actor_id");

      if (claimError) {
        logger.error({ error: claimError }, "Error claiming day-start ledger row");
        return false;
      }

      // Someone else already started this day for this actor.
      if (!claimed || claimed.length === 0) {
        return false;
      }

      const { data: recipientIds, error: recipientsError } = await adminClient.rpc(
        "get_day_start_recipients",
        { p_actor_id: input.actorId, p_festival_id: input.festivalId },
      );

      // The ledger row is already claimed, so this day-start is spent either
      // way. Report failure so the caller still falls back to its ordinary
      // notification rather than staying silent on our behalf.
      if (recipientsError) {
        logger.error({ error: recipientsError }, "Error resolving day-start recipients");
        return false;
      }

      const recipients = (recipientIds ?? []) as string[];
      const toNotify = await this.filterByPreference(recipients, "day_start_enabled");

      // null means the preference lookup itself failed (not "nobody opted
      // in"), so degrade to the tent check-in fallback rather than going
      // silent for this user-day.
      if (toNotify === null) {
        return false;
      }

      if (toNotify.length === 0) {
        return true;
      }

      const { data: actor, error: actorError } = await this.supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", input.actorId)
        .single();

      if (actorError || !actor) {
        logger.error({ error: actorError }, "Error fetching actor for day-start notification");
        return false;
      }

      const actorName = actor.username || actor.full_name || "Someone";
      const actorAvatar = resolveAvatarUrl(actor.avatar_url);

      const results = await Promise.allSettled(
        toNotify.map((recipientId) =>
          this.novu.trigger({
            workflowId: NOTIFICATION_WORKFLOWS.DAY_START,
            to: recipientId,
            payload: {
              actorName,
              actorAvatar,
              kind: input.kind,
              tentName: input.tentName ?? "",
            },
          }),
        ),
      );

      // allSettled hides rejections, so surface them: a trigger that fails
      // here is otherwise indistinguishable from one that was never sent. The
      // ledger row stays claimed regardless (this actor's day-start is used
      // up either way), but the caller reads the return value to decide
      // whether to fall back to the ordinary check-in push, so it must be
      // false unless at least one trigger actually went out.
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        logger.error(
          {
            failed: failures.length,
            total: results.length,
            reasons: failures.map((failure) => String((failure as PromiseRejectedResult).reason)),
          },
          "Some day-start notifications failed to send",
        );
      }

      return failures.length < results.length;
    } catch (error) {
      logger.error({ error }, "Error sending day-start notifications");
      return false;
    }
  }

  /**
   * Notify everyone who can see a freshly published group message.
   *
   * Messages are festival-scoped, not group-scoped: they reach everyone sharing
   * at least one group with the author in that festival, which is exactly the
   * audience this fans out to. Gated on group_notifications_enabled — no
   * dedicated preference.
   */
  async notifyGroupMessage(input: {
    authorId: string;
    festivalId: string;
    messageType: "message" | "alert";
  }): Promise<void> {
    try {
      const { data: viewers, error: viewersError } = await this.supabase
        .from("v_user_shared_group_members")
        .select("viewer_id")
        .eq("owner_id", input.authorId)
        .eq("festival_id", input.festivalId);

      if (viewersError) {
        logger.error({ error: viewersError }, "Error resolving group message recipients");
        return;
      }

      const recipientIds = [
        ...new Set(
          (viewers ?? [])
            .map((viewer) => viewer.viewer_id)
            .filter((viewerId): viewerId is string => !!viewerId && viewerId !== input.authorId),
        ),
      ];

      if (recipientIds.length === 0) {
        return;
      }

      const toNotify = await this.filterByPreference(recipientIds, "group_notifications_enabled");

      if (!toNotify || toNotify.length === 0) {
        return;
      }

      const { data: author, error: authorError } = await this.supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", input.authorId)
        .single();

      if (authorError || !author) {
        logger.error({ error: authorError }, "Error fetching author for group message");
        return;
      }

      const authorName = author.username || author.full_name || "Someone";
      const authorAvatar = resolveAvatarUrl(author.avatar_url);
      const groupByRecipient = await this.resolveFirstSharedGroup(input.authorId, input.festivalId);

      const results = await Promise.allSettled(
        toNotify.map((recipientId) => {
          const payload: Record<string, unknown> = {
            authorName,
            authorAvatar,
            messageType: input.messageType,
          };
          const groupId = groupByRecipient.get(recipientId);
          if (groupId) {
            payload.groupId = groupId;
          }
          return this.novu.trigger({
            workflowId: NOTIFICATION_WORKFLOWS.GROUP_MESSAGE,
            to: recipientId,
            payload,
          });
        }),
      );

      // allSettled hides rejections, so surface them: a trigger that fails
      // here is otherwise indistinguishable from one that was never sent.
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        logger.error(
          {
            failed: failures.length,
            total: results.length,
            reasons: failures.map((failure) => String((failure as PromiseRejectedResult).reason)),
          },
          "Some group message notifications failed to send",
        );
      }
    } catch (error) {
      logger.error({ error }, "Error sending group message notifications");
    }
  }

  /**
   * Best-effort deep link: the first group (by DB return order) that the
   * author and a recipient both belong to, in this festival. Deliberately
   * separate from recipient resolution above — a failure or empty result here
   * never drops a recipient, it just means their push omits `groupId` and the
   * client falls back to the groups list.
   */
  private async resolveFirstSharedGroup(
    authorId: string,
    festivalId: string,
  ): Promise<Map<string, string>> {
    const groupByRecipient = new Map<string, string>();
    try {
      const { data: authorMemberships, error: authorGroupsError } = await this.supabase
        .from("group_members")
        .select("group_id, groups!inner(festival_id)")
        .eq("user_id", authorId)
        .eq("groups.festival_id", festivalId);

      if (authorGroupsError || !authorMemberships || authorMemberships.length === 0) {
        return groupByRecipient;
      }

      const authorGroupIds = authorMemberships.map((membership) => membership.group_id);

      const { data: coMembers, error: coMembersError } = await this.supabase
        .from("group_members")
        .select("user_id, group_id")
        .in("group_id", authorGroupIds);

      if (coMembersError) {
        return groupByRecipient;
      }

      for (const member of coMembers ?? []) {
        if (
          !member.user_id ||
          !member.group_id ||
          member.user_id === authorId ||
          groupByRecipient.has(member.user_id)
        ) {
          continue;
        }
        groupByRecipient.set(member.user_id, member.group_id);
      }
    } catch (error) {
      logger.error({ error }, "Error resolving shared group for group message deep link");
    }

    return groupByRecipient;
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
        logger.error({ error: userError }, "Error fetching user for tent checkin");
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

      const memberIds = [
        ...new Set(groupMembers.map((member) => member.user_id).filter((id) => id !== null)),
      ];

      const membersToNotify = await this.filterByPreference(memberIds, "checkin_enabled");

      if (!membersToNotify || membersToNotify.length === 0) {
        return;
      }

      const userName = user.username || user.full_name || "Someone";
      const userAvatar = resolveAvatarUrl(user.avatar_url);

      // Send notifications to all eligible members with their specific group context
      const notificationPromises = membersToNotify.map((memberId) => {
        // Find groups this specific member shares with the check-in user
        const memberGroups = groupMembers
          .filter((gm) => gm.user_id === memberId)

          .map((gm) => (gm.groups as any)?.name)
          .filter(Boolean);

        const groupNamesText = memberGroups.length > 0 ? memberGroups.join(", ") : "Group";

        return this.novu.trigger({
          workflowId: NOTIFICATION_WORKFLOWS.TENT_CHECKIN,
          to: memberId,
          payload: {
            userName,
            tentName,
            groupName: groupNamesText,
            userAvatar,
          },
        });
      });

      const results = await Promise.allSettled(notificationPromises);

      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        logger.error(
          {
            failed: failures.length,
            total: results.length,
            reasons: failures.map((failure) => String((failure as PromiseRejectedResult).reason)),
          },
          "Some tent checkin notifications failed to send",
        );
      }
    } catch (error) {
      logger.error({ error }, "Error sending tent checkin notifications");
    }
  }
}
