/**
 * Background Sync
 *
 * Implements background data synchronization using expo-task-manager
 * and expo-background-fetch.
 *
 * Background sync allows the app to periodically synchronize data
 * even when the app is not in the foreground, ensuring data
 * consistency and reducing sync time when the user opens the app.
 *
 * Requirements:
 * - expo-task-manager (already installed)
 * - expo-background-fetch (needs to be installed: npx expo install expo-background-fetch)
 * - iOS: UIBackgroundModes includes "fetch" and "processing" in app.config.ts
 * - Android: Permissions for RECEIVE_BOOT_COMPLETED (auto-configured)
 */

import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { logger } from "@/lib/logger";

import { initializeDatabase } from "./init";
import { createSyncManager, type SyncResult } from "./sync-manager";

// Task name constant
export const BACKGROUND_SYNC_TASK = "PROSTCOUNTER_BACKGROUND_SYNC";

// Result type for background fetch (matches expo-background-fetch)
export enum BackgroundFetchResult {
  NoData = 1,
  NewData = 2,
  Failed = 3,
}

/**
 * Helper to safely load expo-background-fetch.
 * Returns null if the module is not installed.
 */

function getBackgroundFetchModule(): any | null {
  try {
    // Use require to avoid TypeScript module resolution errors

    return require("expo-background-fetch");
  } catch {
    return null;
  }
}

/**
 * Define the background sync task.
 * This must be called at the module level (before app renders).
 */
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  logger.info("[BackgroundSync] Task started");

  try {
    // Initialize database (may already be initialized)
    const db = await initializeDatabase();
    const syncManager = createSyncManager(db);

    // Get festival and user IDs from storage
    const AsyncStorage =
      await import("@react-native-async-storage/async-storage").then(
        (m) => m.default,
      );

    const festivalId = await AsyncStorage.getItem("current_festival_id");
    const userId = await AsyncStorage.getItem("current_user_id");

    if (!festivalId || !userId) {
      logger.debug(
        "[BackgroundSync] No festival or user ID found, skipping sync",
      );
      return BackgroundFetchResult.NoData;
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
      return BackgroundFetchResult.Failed;
    }

    if (result.pulled > 0 || result.pushed > 0) {
      return BackgroundFetchResult.NewData;
    }

    return BackgroundFetchResult.NoData;
  } catch (error) {
    logger.error("[BackgroundSync] Task failed:", error);
    return BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background sync task with the system.
 * Call this once when the app initializes (after user is authenticated).
 *
 * @param minimumIntervalSeconds - Minimum time between background fetches (default: 15 minutes)
 * @returns Promise<boolean> - Whether registration was successful
 */
export async function registerBackgroundSync(
  minimumIntervalSeconds: number = 15 * 60,
): Promise<boolean> {
  // Background fetch only available on native platforms
  if (Platform.OS === "web") {
    logger.debug("[BackgroundSync] Not available on web");
    return false;
  }

  try {
    const BackgroundFetch = getBackgroundFetchModule();

    if (!BackgroundFetch) {
      logger.warn(
        "[BackgroundSync] expo-background-fetch not installed. Run: npx expo install expo-background-fetch",
      );
      return false;
    }

    // Check if task is already registered
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      logger.debug("[BackgroundSync] Task already registered");
      return true;
    }

    // Register the background fetch task
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: minimumIntervalSeconds,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    logger.info("[BackgroundSync] Task registered successfully", {
      minimumIntervalSeconds,
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

    const BackgroundFetch = getBackgroundFetchModule();
    if (BackgroundFetch) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    }

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
 * Get the status of background fetch (iOS only).
 * Returns the system's background fetch status.
 */
export async function getBackgroundFetchStatus(): Promise<number | null> {
  if (Platform.OS !== "ios") {
    return null;
  }

  try {
    const BackgroundFetch = getBackgroundFetchModule();
    if (!BackgroundFetch) {
      return null;
    }
    return await BackgroundFetch.getStatusAsync();
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
  try {
    const AsyncStorage =
      await import("@react-native-async-storage/async-storage").then(
        (m) => m.default,
      );

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
