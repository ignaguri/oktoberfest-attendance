import {
  DEFAULT_AVATAR_URL,
  IS_PROD,
  PROD_URL,
  DEV_URL,
} from "@/lib/constants";
import { ACHIEVEMENT_UNLOCKED_WORKFLOW_ID } from "@/novu/workflows/achievement-unlocked";
import { GROUP_ACHIEVEMENT_UNLOCKED_WORKFLOW_ID } from "@/novu/workflows/group-achievement-unlocked";
import { GROUP_JOIN_WORKFLOW_ID } from "@/novu/workflows/group-join";
import { RESERVATION_PROMPT_WORKFLOW_ID } from "@/novu/workflows/reservation-prompt";
import { RESERVATION_REMINDER_WORKFLOW_ID } from "@/novu/workflows/reservation-reminder";
import { TENT_CHECKIN_WORKFLOW_ID } from "@/novu/workflows/tent-check-in";
import {
  reportNotificationException,
  reportSupabaseException,
} from "@/utils/sentry";
import { Novu } from "@novu/api";
import { ChatOrPushProviderEnum } from "@novu/api/models/components";
import { createClient as createBrowserClient } from "@supabase/supabase-js";

import type { Tables } from "@/lib/database.types";
import type { PostgrestError } from "@supabase/supabase-js";

type NotificationPreferences = Tables<"user_notification_preferences">;

/**
 * Notification workflow identifiers
 * These should match the workflow IDs configured in Novu
 */
export const NOTIFICATION_WORKFLOWS = {
  GROUP_JOIN: GROUP_JOIN_WORKFLOW_ID,
  TENT_CHECKIN: TENT_CHECKIN_WORKFLOW_ID,
  RESERVATION_REMINDER: RESERVATION_REMINDER_WORKFLOW_ID,
  RESERVATION_CHECKIN_PROMPT: RESERVATION_PROMPT_WORKFLOW_ID,
  ACHIEVEMENT_UNLOCKED: ACHIEVEMENT_UNLOCKED_WORKFLOW_ID,
  GROUP_ACHIEVEMENT_UNLOCKED: GROUP_ACHIEVEMENT_UNLOCKED_WORKFLOW_ID,
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
    // Use direct service role client to access all user data for notifications
    // This bypasses any user session cookies that might interfere with service role access
    this.supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    // Initialize Novu with API key
    const novuApiKey = process.env.NOVU_API_KEY;
    if (!novuApiKey) {
      throw new Error("NOVU_API_KEY environment variable is required");
    }
    this.novu = new Novu({
      secretKey: novuApiKey,
    });
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
      const { data: prefs } = await this.supabase
        .from("user_notification_preferences")
        .select("reminders_enabled")
        .eq("user_id", userId)
        .single();

      if (prefs && prefs.reminders_enabled === false) {
        return;
      }

      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.RESERVATION_REMINDER,
        to: userId,
        payload,
      });
    } catch (error) {
      reportNotificationException("notifyReservationReminder", error as Error);
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
      const { data: prefs } = await this.supabase
        .from("user_notification_preferences")
        .select("reminders_enabled")
        .eq("user_id", userId)
        .single();

      if (prefs && prefs.reminders_enabled === false) {
        return;
      }

      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.RESERVATION_CHECKIN_PROMPT,
        to: userId,
        payload,
      });
    } catch (error) {
      reportNotificationException("notifyReservationPrompt", error as Error);
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
      const { data: prefs } = await this.supabase
        .from("user_notification_preferences")
        .select("achievement_notifications_enabled")
        .eq("user_id", userId)
        .single();

      if (prefs && prefs.achievement_notifications_enabled === false) {
        return;
      }

      await this.novu.trigger({
        workflowId: NOTIFICATION_WORKFLOWS.ACHIEVEMENT_UNLOCKED,
        to: userId,
        payload,
      });
    } catch (error) {
      reportNotificationException("notifyAchievementUnlocked", error as Error);
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
        reportSupabaseException(
          "notifyGroupAchievement",
          error as PostgrestError,
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
      reportNotificationException("notifyGroupAchievement", error as Error);
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
      // Construct proper avatar URL - if avatar_url is just a filename, construct the full URL
      let joinerAvatar = DEFAULT_AVATAR_URL;
      if (newMember.avatar_url && newMember.avatar_url.trim()) {
        // Check if it's already a full URL
        if (
          newMember.avatar_url.startsWith("http://") ||
          newMember.avatar_url.startsWith("https://")
        ) {
          joinerAvatar = newMember.avatar_url;
        } else {
          // It's a filename, construct the full URL
          joinerAvatar = `${IS_PROD ? PROD_URL : DEV_URL}/api/image/${newMember.avatar_url}`;
        }
      }

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
      reportNotificationException("notifyGroupJoin", error as Error);
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
        .select("username, full_name, avatar_url")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        reportSupabaseException(
          "notifyTentCheckin",
          userError as PostgrestError,
        );
        return;
      }

      // Get group names for better notification context
      const { data: groups, error: groupsError } = await this.supabase
        .from("groups")
        .select("name")
        .in("id", groupIds);

      if (groupsError) {
        reportSupabaseException(
          "notifyTentCheckin",
          groupsError as PostgrestError,
        );
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
        reportSupabaseException(
          "notifyTentCheckin",
          membersError as PostgrestError,
        );
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
        reportSupabaseException(
          "notifyTentCheckin",
          prefsError as PostgrestError,
        );
        return;
      }

      if (!membersToNotify || membersToNotify.length === 0) {
        return;
      }

      const userName = user.username || user.full_name || "Someone";

      // Construct proper avatar URL - if avatar_url is just a filename, construct the full URL
      let userAvatar = DEFAULT_AVATAR_URL;
      if (user.avatar_url && user.avatar_url.trim()) {
        // Check if it's already a full URL
        if (
          user.avatar_url.startsWith("http://") ||
          user.avatar_url.startsWith("https://")
        ) {
          userAvatar = user.avatar_url;
        } else {
          // It's a filename, construct the full URL
          userAvatar = `${IS_PROD ? PROD_URL : DEV_URL}/api/image/${user.avatar_url}`;
        }
      }

      // Send notifications to all eligible members
      const notificationPromises = membersToNotify.map((member) =>
        this.novu.trigger({
          workflowId: NOTIFICATION_WORKFLOWS.TENT_CHECKIN,
          to: member.user_id!,
          payload: {
            userName,
            tentName,
            groupName: groupNamesText,
            userAvatar,
          },
        }),
      );

      await Promise.allSettled(notificationPromises);
    } catch (error) {
      reportNotificationException("notifyTentCheckin", error as Error);
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
      await this.novu.subscribers.create({
        subscriberId: userId,
        email: userEmail,
        firstName,
        lastName,
        avatar,
      });
    } catch (error) {
      reportNotificationException("subscribeUser", error as Error, {
        id: userId,
        email: userEmail,
      });
    }
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
      reportNotificationException("registerFCMToken", error as Error, {
        id: userId,
      });
      return false;
    }
  }

  /**
   * Update FCM device tokens for a subscriber
   * This replaces all existing tokens with the new ones
   */
  async updateFCMTokens(userId: string, tokens: string[]): Promise<boolean> {
    try {
      await this.novu.subscribers.credentials.update(
        {
          providerId: ChatOrPushProviderEnum.Fcm,
          credentials: {
            deviceTokens: tokens,
          },
        },
        userId,
      );
      return true;
    } catch (error) {
      reportNotificationException("updateFCMTokens", error as Error, {
        id: userId,
      });
      return false;
    }
  }
}

// Factory function to create instance on demand
export const createNotificationService = () => new NotificationService();
