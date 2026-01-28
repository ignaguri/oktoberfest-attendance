import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { logger } from "@/lib/logger";

/**
 * Background location task name
 */
export const BACKGROUND_LOCATION_TASK = "PROSTCOUNTER_BACKGROUND_LOCATION";

/**
 * AsyncStorage key for persisting background location data
 */
const BG_DATA_STORAGE_KEY = "prostcounter_bg_location_data";

/**
 * Type for location update callback stored in AsyncStorage or context
 */
export interface BackgroundLocationData {
  sessionId: string;
  userId: string;
  festivalId: string;
}

/**
 * Global callback for handling background location updates
 * This must be set by the LocationContext before starting background updates
 */
let onBackgroundLocationUpdate:
  | ((
      location: Location.LocationObject,
      data: BackgroundLocationData,
    ) => Promise<void>)
  | null = null;

/**
 * Global data for background location task (also persisted to AsyncStorage)
 */
let backgroundLocationData: BackgroundLocationData | null = null;

/**
 * Counter for consecutive callback-missing invocations
 */
let missingCallbackCount = 0;
const MAX_MISSING_CALLBACK = 5;

/**
 * Set the callback for background location updates
 */
export function setBackgroundLocationCallback(
  callback:
    | ((
        location: Location.LocationObject,
        data: BackgroundLocationData,
      ) => Promise<void>)
    | null,
) {
  onBackgroundLocationUpdate = callback;
  if (callback) {
    missingCallbackCount = 0;
  }
}

/**
 * Set the data for background location task (also persists to AsyncStorage)
 */
export async function setBackgroundLocationData(
  data: BackgroundLocationData | null,
) {
  backgroundLocationData = data;
  try {
    if (data) {
      await AsyncStorage.setItem(BG_DATA_STORAGE_KEY, JSON.stringify(data));
    } else {
      await AsyncStorage.removeItem(BG_DATA_STORAGE_KEY);
    }
  } catch (err) {
    logger.error("Error persisting data", err);
  }
}

/**
 * Retrieve persisted background location data from AsyncStorage
 * Used when the task runs in a cold state (globals are null)
 */
async function getPersistedData(): Promise<BackgroundLocationData | null> {
  try {
    const raw = await AsyncStorage.getItem(BG_DATA_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as BackgroundLocationData;
    }
  } catch (err) {
    logger.error("Error reading persisted data", err);
  }
  return null;
}

/**
 * Define the background location task
 * This must be called at the top level of the app (outside of React components)
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    logger.error("Task error", error);
    return;
  }

  if (!data) {
    logger.warn("No data received");
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };

  if (!locations || locations.length === 0) {
    logger.warn("No locations in data");
    return;
  }

  // Get the most recent location
  const latestLocation = locations[locations.length - 1];

  logger.debug("Received location", {
    latitude: latestLocation.coords.latitude,
    longitude: latestLocation.coords.longitude,
  });

  // Recover data from AsyncStorage if globals were cleared (cold start)
  if (!backgroundLocationData) {
    backgroundLocationData = await getPersistedData();
  }

  // Call the callback if set
  if (onBackgroundLocationUpdate && backgroundLocationData) {
    missingCallbackCount = 0;
    try {
      await onBackgroundLocationUpdate(latestLocation, backgroundLocationData);
    } catch (err) {
      logger.error("Error in callback", err);
    }
  } else {
    missingCallbackCount++;
    logger.warn("Callback or data missing", {
      attempt: missingCallbackCount,
      max: MAX_MISSING_CALLBACK,
    });

    // Stop updates if callback is consistently missing to save battery
    if (missingCallbackCount >= MAX_MISSING_CALLBACK) {
      logger.warn("Max missing callback attempts reached, stopping updates");
      try {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      } catch (err) {
        logger.error("Error auto-stopping", err);
      }
    }
  }
});

/**
 * Start background location updates
 * @param data Session data for the background task
 * @returns true if started successfully
 */
export async function startBackgroundLocationUpdates(
  data: BackgroundLocationData,
): Promise<boolean> {
  try {
    // Check if background location task is already running
    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );

    if (isRunning) {
      logger.debug("Task already running, stopping first");
      await stopBackgroundLocationUpdates();
    }

    // Store the data for the task (persists to AsyncStorage)
    await setBackgroundLocationData(data);
    missingCallbackCount = 0;

    // Start background location updates
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30000, // 30 seconds
      distanceInterval: 50, // 50 meters
      deferredUpdatesInterval: 60000, // Batch updates every minute if possible
      foregroundService: {
        notificationTitle: "Location Sharing Active",
        notificationBody: "Your friends can see your location",
        notificationColor: "#F59E0B", // Brand yellow
      },
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
    });

    logger.info("Started successfully");
    return true;
  } catch (error) {
    logger.error("Error starting", error);
    return false;
  }
}

/**
 * Stop background location updates
 */
export async function stopBackgroundLocationUpdates(): Promise<void> {
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );

    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      logger.info("Stopped successfully");
    }

    // Clear the data (including persisted)
    await setBackgroundLocationData(null);
  } catch (error) {
    logger.error("Error stopping", error);
  }
}

/**
 * Check if background location updates are running
 */
export async function isBackgroundLocationRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
  } catch (error) {
    logger.error("Error checking status", error);
    return false;
  }
}
