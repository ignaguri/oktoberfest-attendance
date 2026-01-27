import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getLocationPermissionStatus,
  type LocationPermissionStatus,
  setLocationPermissionStatus,
} from "@/lib/auth/secure-storage";

/**
 * Location hook for managing device location and permissions
 */
export function useLocation() {
  // Permission state
  const [permissionStatus, setPermissionStatusState] =
    useState<LocationPermissionStatus>("undetermined");
  const [isPermissionLoading, setIsPermissionLoading] = useState(true);

  // Location state
  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObject | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Subscription reference for watching location
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );

  /**
   * Load initial permission status from storage and sync with device
   */
  useEffect(() => {
    async function loadPermissionState() {
      try {
        const [storedStatus, foreground, background] = await Promise.all([
          getLocationPermissionStatus(),
          Location.getForegroundPermissionsAsync(),
          Location.getBackgroundPermissionsAsync(),
        ]);

        // Determine actual status based on device permissions
        let actualStatus: LocationPermissionStatus = "undetermined";
        if (foreground.status === "denied") {
          actualStatus = "denied";
        } else if (
          foreground.status === "granted" &&
          background.status === "granted"
        ) {
          actualStatus = "background";
        } else if (foreground.status === "granted") {
          actualStatus = "foreground";
        }

        // Sync with stored status if different
        if (actualStatus !== storedStatus) {
          console.log(
            `[Location] Syncing permission status: stored=${storedStatus}, device=${actualStatus}`,
          );
          await setLocationPermissionStatus(actualStatus);
        }

        setPermissionStatusState(actualStatus);
      } catch (error) {
        console.error("[Location] Error loading permission state:", error);
      } finally {
        setIsPermissionLoading(false);
      }
    }

    loadPermissionState();
  }, []);

  /**
   * Request foreground location permission
   * @returns true if granted, false otherwise
   */
  const requestForegroundPermission =
    useCallback(async (): Promise<boolean> => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status === "granted") {
          setPermissionStatusState("foreground");
          await setLocationPermissionStatus("foreground");
          return true;
        }

        setPermissionStatusState("denied");
        await setLocationPermissionStatus("denied");
        return false;
      } catch (error) {
        console.error(
          "[Location] Error requesting foreground permission:",
          error,
        );
        return false;
      }
    }, []);

  /**
   * Request background location permission (must have foreground first)
   * @returns true if granted, false otherwise
   */
  const requestBackgroundPermission =
    useCallback(async (): Promise<boolean> => {
      try {
        // Check if foreground permission is granted first
        const foreground = await Location.getForegroundPermissionsAsync();
        if (foreground.status !== "granted") {
          console.warn(
            "[Location] Must have foreground permission before requesting background",
          );
          return false;
        }

        const { status } = await Location.requestBackgroundPermissionsAsync();

        if (status === "granted") {
          setPermissionStatusState("background");
          await setLocationPermissionStatus("background");
          return true;
        }

        // Keep foreground status if background was denied
        return false;
      } catch (error) {
        console.error(
          "[Location] Error requesting background permission:",
          error,
        );
        return false;
      }
    }, []);

  /**
   * Request both foreground and background permissions
   * @returns "background" | "foreground" | "denied" based on what was granted
   */
  const requestAllPermissions =
    useCallback(async (): Promise<LocationPermissionStatus> => {
      const foregroundGranted = await requestForegroundPermission();

      if (!foregroundGranted) {
        return "denied";
      }

      const backgroundGranted = await requestBackgroundPermission();
      return backgroundGranted ? "background" : "foreground";
    }, [requestForegroundPermission, requestBackgroundPermission]);

  /**
   * Get current location once
   */
  const getCurrentLocation =
    useCallback(async (): Promise<Location.LocationObject | null> => {
      if (
        permissionStatus !== "foreground" &&
        permissionStatus !== "background"
      ) {
        console.warn("[Location] Permission not granted");
        return null;
      }

      setIsLocationLoading(true);
      setLocationError(null);

      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setCurrentLocation(location);
        return location;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to get location";
        setLocationError(message);
        console.error("[Location] Error getting current location:", error);
        return null;
      } finally {
        setIsLocationLoading(false);
      }
    }, [permissionStatus]);

  /**
   * Start watching location updates
   * @param callback Function to call with each location update
   * @param options Location watch options
   */
  const startWatching = useCallback(
    async (
      callback: (location: Location.LocationObject) => void,
      options?: {
        accuracy?: Location.Accuracy;
        distanceInterval?: number;
        timeInterval?: number;
      },
    ): Promise<boolean> => {
      if (
        permissionStatus !== "foreground" &&
        permissionStatus !== "background"
      ) {
        console.warn("[Location] Permission not granted for watching");
        return false;
      }

      // Stop existing subscription if any
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }

      try {
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: options?.accuracy ?? Location.Accuracy.Balanced,
            distanceInterval: options?.distanceInterval ?? 50, // meters
            timeInterval: options?.timeInterval ?? 30000, // 30 seconds
          },
          (location) => {
            setCurrentLocation(location);
            callback(location);
          },
        );

        return true;
      } catch (error) {
        console.error("[Location] Error starting location watch:", error);
        return false;
      }
    },
    [permissionStatus],
  );

  /**
   * Stop watching location updates
   */
  const stopWatching = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWatching();
    };
  }, [stopWatching]);

  /**
   * Check if location services are enabled on the device
   */
  const checkLocationServicesEnabled =
    useCallback(async (): Promise<boolean> => {
      try {
        return await Location.hasServicesEnabledAsync();
      } catch (error) {
        console.error("[Location] Error checking location services:", error);
        return false;
      }
    }, []);

  return {
    // Permission state
    permissionStatus,
    isPermissionLoading,
    hasPermission:
      permissionStatus === "foreground" || permissionStatus === "background",
    hasBackgroundPermission: permissionStatus === "background",

    // Location state
    currentLocation,
    isLocationLoading,
    locationError,

    // Permission actions
    requestForegroundPermission,
    requestBackgroundPermission,
    requestAllPermissions,

    // Location actions
    getCurrentLocation,
    startWatching,
    stopWatching,
    checkLocationServicesEnabled,
  };
}
