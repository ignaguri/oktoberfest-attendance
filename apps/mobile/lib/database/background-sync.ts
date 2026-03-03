/**
 * Background Sync
 *
 * Implements background data synchronization using expo-task-manager
 * and expo-background-task (replaces deprecated expo-background-fetch in SDK 55).
 *
 * Background sync allows the app to periodically synchronize data
 * even when the app is not in the foreground, ensuring data
 * consistency and reducing sync time when the user opens the app.
 *
 * Requirements:
 * - expo-task-manager (already installed)
 * - expo-background-task
 * - iOS: UIBackgroundModes includes "fetch" and "processing" in app.config.ts
 * - Android: Permissions for RECEIVE_BOOT_COMPLETED (auto-configured)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import { BackgroundTaskResult } from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { logger } from "@/lib/logger";

import { initializeDatabase } from "./init";
import { createSyncManager, type SyncResult } from "./sync/sync-manager";

// Task name constant
export const BACKGROUND_SYNC_TASK = "PROSTCOUNTER_BACKGROUND_SYNC";

/**
 * Ensures the background sync task is defined with TaskManager.
 * Uses TaskManager.isTaskDefined() to prevent duplicate registrations
 * across HMR reloads and re-evaluations.
 * Must be called before registering the task.
 */
function ensureTaskDefined() {
  if (TaskManager.isTaskDefined(BACKGROUND_SYNC_TASK)) return;

  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    logger.info("[BackgroundSync] Task started");

    try {
      // Initialize database (may already be initialized)
      const db = await initializeDatabase();
      const syncManager = createSyncManager(db);

      // Get festival and user IDs from storage
      const festivalId = await AsyncStorage.getItem("current_festival_id");
      const userId = await AsyncStorage.getItem("current_user_id");

      if (!festivalId || !userId) {
        logger.debug(
          "[BackgroundSync] No festival or user ID found, skipping sync",
        );
        return BackgroundTaskResult.Success;
      }

      // Perform sync
      const result: SyncResult = await syncManager.sync({
        direction: "both",
        festivalId,
        userId,
      });

      logger.info("[BackgroundSync] Sync completed", {
        pulled: result.pulled,
        pushed: result.pushed,
        failed: result.failed,
      });

      if (result.failed > 0) {
        return BackgroundTaskResult.Failed;
      }

      return BackgroundTaskResult.Success;
    } catch (error) {
      logger.error("[BackgroundSync] Task failed:", error);
      return BackgroundTaskResult.Failed;
    }
  });
}

/**
 * Register the background sync task with the system.
 * Call this once when the app initializes (after user is authenticated).
 *
 * @param minimumIntervalMinutes - Minimum time between background tasks (default: 15 minutes)
 * @returns Promise<boolean> - Whether registration was successful
 */
export async function registerBackgroundSync(
  minimumIntervalMinutes: number = 15,
): Promise<boolean> {
  // Background task only available on native platforms
  if (Platform.OS === "web") {
    logger.debug("[BackgroundSync] Not available on web");
    return false;
  }

  try {
    // Ensure the task is defined before registering
    ensureTaskDefined();

    // Check if task is already registered
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      logger.debug("[BackgroundSync] Task already registered");
      return true;
    }

    // Register the background task
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: minimumIntervalMinutes,
    });

    logger.info("[BackgroundSync] Task registered successfully", {
      minimumIntervalMinutes,
    });
    return true;
  } catch (error) {
    logger.error("[BackgroundSync] Failed to register task:", error);
    return false;
  }
}

/**
 * Unregister the background sync task.
 * Call this when user logs out or disables background sync.
 */
export async function unregisterBackgroundSync(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  try {
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (!isRegistered) {
      return true;
    }

    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);

    logger.info("[BackgroundSync] Task unregistered");
    return true;
  } catch (error) {
    logger.error("[BackgroundSync] Failed to unregister task:", error);
    return false;
  }
}

/**
 * Check if background sync is available and registered.
 */
export async function isBackgroundSyncEnabled(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
  } catch {
    return false;
  }
}

/**
 * Get the status of background task.
 * Returns the system's background task status.
 */
export async function getBackgroundTaskStatus(): Promise<number | null> {
  if (Platform.OS !== "ios") {
    return null;
  }

  try {
    return await BackgroundTask.getStatusAsync();
  } catch {
    return null;
  }
}

/**
 * Stores the current user and festival IDs for background sync.
 * Call this when user logs in or changes festival.
 */
export async function setBackgroundSyncContext(
  userId: string | null,
  festivalId: string | null,
): Promise<void> {
  // Ensure the task is defined before setting context
  ensureTaskDefined();

  try {
    if (userId) {
      await AsyncStorage.setItem("current_user_id", userId);
    } else {
      await AsyncStorage.removeItem("current_user_id");
    }

    if (festivalId) {
      await AsyncStorage.setItem("current_festival_id", festivalId);
    } else {
      await AsyncStorage.removeItem("current_festival_id");
    }

    logger.debug("[BackgroundSync] Context updated", { userId, festivalId });
  } catch (error) {
    logger.error("[BackgroundSync] Failed to set context:", error);
  }
}
