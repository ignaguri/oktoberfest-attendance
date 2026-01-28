import type { Database } from "@prostcounter/db";
import type {
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger";
import { DatabaseError } from "../../middleware/error";
import type { INotificationRepository } from "../interfaces/notification.repository";

export class SupabaseNotificationRepository implements INotificationRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async registerFCMToken(userId: string, token: string): Promise<void> {
    // TODO: Implement FCM token storage once fcm_tokens table is added to schema
    // For now, FCM tokens are stored client-side
    // Future schema: CREATE TABLE fcm_tokens (id, user_id, token, last_used_at, is_active)
    logger.debug(
      {
        userId,
        tokenPrefix: token.substring(0, 20),
      },
      "FCM token registration",
    );
  }

  async getPreferences(
    userId: string,
  ): Promise<NotificationPreferences | null> {
    const { data, error } = await this.supabase
      .from("user_notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      throw new DatabaseError(
        `Failed to fetch notification preferences: ${error.message}`,
      );
    }

    if (!data) return null;

    return {
      userId: data.user_id || "",
      pushEnabled: data.push_enabled,
      groupJoinEnabled: data.group_join_enabled,
      checkinEnabled: data.checkin_enabled,
      remindersEnabled: data.reminders_enabled,
      achievementNotificationsEnabled: data.achievement_notifications_enabled,
      groupNotificationsEnabled: data.group_notifications_enabled,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updatePreferences(
    userId: string,
    preferences: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> {
    const { data, error } = await this.supabase
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
      )
      .select()
      .single();

    if (error || !data) {
      throw new DatabaseError(
        `Failed to update notification preferences: ${error?.message || "No data returned"}`,
      );
    }

    return {
      userId: data.user_id || "",
      pushEnabled: data.push_enabled,
      groupJoinEnabled: data.group_join_enabled,
      checkinEnabled: data.checkin_enabled,
      remindersEnabled: data.reminders_enabled,
      achievementNotificationsEnabled: data.achievement_notifications_enabled,
      groupNotificationsEnabled: data.group_notifications_enabled,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async getFCMTokens(userId: string): Promise<string[]> {
    // TODO: Implement once fcm_tokens table is added
    // For now, return empty array
    return [];
  }

  async removeFCMToken(userId: string, token: string): Promise<void> {
    // TODO: Implement once fcm_tokens table is added
    logger.debug(
      {
        userId,
        tokenPrefix: token.substring(0, 20),
      },
      "FCM token removal",
    );
  }

  async canSendNotification(
    userId: string,
    notificationType: string,
  ): Promise<boolean> {
    // Simple rate limiting using notification_rate_limit table
    // Check if user has been notified recently (within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from("notification_rate_limit")
      .select("created_at")
      .eq("user_id", userId)
      .eq("notification_type", notificationType)
      .gte("created_at", oneHourAgo)
      .limit(5); // Check if more than 5 in last hour

    if (error && error.code !== "PGRST116") {
      throw new DatabaseError(
        `Failed to check notification rate limit: ${error.message}`,
      );
    }

    // Allow if less than 5 notifications in the last hour
    return !data || data.length < 5;
  }

  async recordNotificationSent(
    userId: string,
    notificationType: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("notification_rate_limit")
      .insert({
        user_id: userId,
        notification_type: notificationType,
      });

    if (error) {
      throw new DatabaseError(
        `Failed to record notification: ${error.message}`,
      );
    }
  }
}
