"use server";

import { logger } from "@/lib/logger";
import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

import "server-only";

export async function deleteAccount() {
  const supabase = await createClient();

  // Get the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("User not authenticated");
  }

  // Delete all user data in the correct order (respecting foreign key constraints)
  const deleteOperations = [
    // Delete user's beer pictures first (has foreign keys to attendances)
    supabase.from("beer_pictures").delete().eq("user_id", user.id),

    // Delete user's attendances
    supabase.from("attendances").delete().eq("user_id", user.id),

    // Delete user's tent visits
    supabase.from("tent_visits").delete().eq("user_id", user.id),

    // Delete user's group memberships
    supabase.from("group_members").delete().eq("user_id", user.id),

    // Delete user's notification preferences
    supabase
      .from("user_notification_preferences")
      .delete()
      .eq("user_id", user.id),

    // Delete user's achievements
    supabase.from("user_achievements").delete().eq("user_id", user.id),

    // Delete user's profile
    supabase.from("profiles").delete().eq("id", user.id),

    // Delete groups created by the user (this will cascade to group_members)
    supabase.from("groups").delete().eq("created_by", user.id),
  ];

  try {
    // Execute all delete operations
    const results = await Promise.allSettled(deleteOperations);

    // Check for any failures
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      logger.warn(
        "Some delete operations failed during account deletion",
        logger.serverAction("deleteAccount", {
          userId: user.id,
          failureCount: failures.length,
        }),
      );
      // Continue anyway - partial deletion is better than no deletion
    }

    // Finally, delete the user account from Supabase Auth
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(
      user.id,
    );

    if (deleteAuthError) {
      // Log the error but don't throw - data is already deleted
      logger.error(
        "Failed to delete auth user during account deletion",
        logger.serverAction("deleteAccount", { userId: user.id }),
        new Error(deleteAuthError.message),
      );
      // Create a compatible error object for reporting
      const compatibleError = {
        message: deleteAuthError.message,
        details: deleteAuthError.name,
        hint: "Auth deletion failed",
      } as any;
      reportSupabaseException(
        "deleteAccount - auth deletion",
        compatibleError,
        { id: user.id },
      );
    }

    // Sign out the user
    await supabase.auth.signOut();
  } catch (error) {
    logger.error(
      "Account deletion failed",
      logger.serverAction("deleteAccount", { userId: user.id }),
      error as Error,
    );
    // Create a compatible error object for reporting
    const compatibleError = {
      message: error instanceof Error ? error.message : String(error),
      details: error instanceof Error ? error.name : "Unknown",
      hint: "Account deletion failed",
    } as any;
    reportSupabaseException("deleteAccount", compatibleError, { id: user.id });
    throw new Error("Failed to delete account. Please contact support.");
  }

  // Redirect to homepage
  redirect("/");
}
