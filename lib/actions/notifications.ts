"use server";

import { createNotificationService } from "@/lib/services/notifications";
import { getProfileShort, getUser } from "@/lib/sharedActions";
import { createClient } from "@/utils/supabase/server";

import "server-only";

/**
 * Sync user profile with Novu
 */
export async function syncUserWithNovu(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await getUser();
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
    console.error("Failed to sync user with Novu:", error);
    return { success: false, error: "Failed to sync user" };
  }
}

/**
 * Get user notification preferences
 */
export async function getUserNotificationPreferences() {
  try {
    const user = await getUser();
    const supabase = createClient();

    const { data, error } = await supabase
      .from("user_notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Error loading notification preferences:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error loading preferences:", error);
    return null;
  }
}

/**
 * Update user notification preferences
 */
export async function updateUserNotificationPreferences(updates: {
  group_join_enabled?: boolean | null;
  checkin_enabled?: boolean | null;
  push_enabled?: boolean | null;
}) {
  try {
    const user = await getUser();
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
      console.error("Error updating preferences:", error);
      throw new Error("Failed to update preferences");
    }

    return data;
  } catch (error) {
    console.error("Failed to update preferences:", error);
    throw error;
  }
}

export async function registerFCMToken(token: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await getUser();

    if (!user || !user.id) {
      return { success: false, error: "User not authenticated" };
    }

    const notificationService = createNotificationService();
    const success = await notificationService.registerFCMToken(user.id, token);

    if (success) {
      // Also enable push notifications in preferences if not already enabled
      try {
        await updateUserNotificationPreferences({ push_enabled: true });
      } catch (error) {
        console.error("Failed to update push preference:", error);
        // Don't fail the entire operation if preference update fails
      }
    }

    return { success };
  } catch (error) {
    console.error("Failed to register FCM token:", error);
    return { success: false, error: "Failed to register token" };
  }
}

export async function updateFCMTokens(tokens: string[]): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await getUser();

    if (!user || !user.id) {
      return { success: false, error: "User not authenticated" };
    }

    const notificationService = createNotificationService();
    const success = await notificationService.updateFCMTokens(user.id, tokens);

    return { success };
  } catch (error) {
    console.error("Failed to update FCM tokens:", error);
    return { success: false, error: "Failed to update tokens" };
  }
}
