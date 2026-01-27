import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

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
    console.error("[BackgroundLocation] Error persisting data:", err);
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
    console.error("[BackgroundLocation] Error reading persisted data:", err);
  }
  return null;
}

/**
 * Define the background location task
 * This must be called at the top level of the app (outside of React components)
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("[BackgroundLocation] Task error:", error);
    return;
  }

  if (!data) {
    console.warn("[BackgroundLocation] No data received");
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };

  if (!locations || locations.length === 0) {
    console.warn("[BackgroundLocation] No locations in data");
    return;
  }

  // Get the most recent location
  const latestLocation = locations[locations.length - 1];

  console.log(
    `[BackgroundLocation] Received location: ${latestLocation.coords.latitude}, ${latestLocation.coords.longitude}`,
  );

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
      console.error("[BackgroundLocation] Error in callback:", err);
    }
  } else {
    missingCallbackCount++;
    console.warn(
      `[BackgroundLocation] Callback or data missing (attempt ${missingCallbackCount}/${MAX_MISSING_CALLBACK})`,
    );

    // Stop updates if callback is consistently missing to save battery
    if (missingCallbackCount >= MAX_MISSING_CALLBACK) {
      console.warn(
        "[BackgroundLocation] Max missing callback attempts reached, stopping updates",
      );
      try {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      } catch (err) {
        console.error("[BackgroundLocation] Error auto-stopping:", err);
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
      console.log("[BackgroundLocation] Task already running, stopping first");
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

    console.log("[BackgroundLocation] Started successfully");
    return true;
  } catch (error) {
    console.error("[BackgroundLocation] Error starting:", error);
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
      console.log("[BackgroundLocation] Stopped successfully");
    }

    // Clear the data (including persisted)
    await setBackgroundLocationData(null);
  } catch (error) {
    console.error("[BackgroundLocation] Error stopping:", error);
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
    console.error("[BackgroundLocation] Error checking status:", error);
    return false;
  }
}
