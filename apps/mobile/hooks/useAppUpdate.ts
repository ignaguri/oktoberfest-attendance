import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppStateStatus } from "react-native";
import { AppState, Platform } from "react-native";

interface AppUpdateState {
  isChecking: boolean;
  isDownloading: boolean;
  isUpdateReady: boolean;
  error: Error | null;
}

/** Minimum interval between update checks (5 minutes). */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Checks for EAS OTA updates when the app comes to the foreground.
 *
 * When an update is found, it is downloaded silently. Once ready,
 * `isUpdateReady` becomes true so the UI can prompt the user to restart.
 *
 * Includes a 5-minute throttle between checks and an in-progress guard
 * to prevent concurrent or excessive API calls.
 *
 * Skips entirely in __DEV__ mode (expo-updates is not active in dev client).
 */
export function useAppUpdate() {
  const [state, setState] = useState<AppUpdateState>({
    isChecking: false,
    isDownloading: false,
    isUpdateReady: false,
    error: null,
  });

  const isCheckingRef = useRef(false);
  const lastCheckRef = useRef(0);

  const checkForUpdate = useCallback(async () => {
    if (__DEV__ || Platform.OS === "web") return;

    // Skip if a check is already in progress
    if (isCheckingRef.current) return;

    // Throttle: skip if last check was less than CHECK_INTERVAL_MS ago
    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_INTERVAL_MS) return;

    isCheckingRef.current = true;
    lastCheckRef.current = now;

    try {
      setState((prev) => ({ ...prev, isChecking: true, error: null }));
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setState((prev) => ({
          ...prev,
          isChecking: false,
          isDownloading: true,
        }));
        await Updates.fetchUpdateAsync();
        setState((prev) => ({
          ...prev,
          isDownloading: false,
          isUpdateReady: true,
        }));
      } else {
        setState((prev) => ({ ...prev, isChecking: false }));
      }
    } catch (error) {
      console.error("Error checking for update:", error);
      setState((prev) => ({
        ...prev,
        isChecking: false,
        isDownloading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (__DEV__ || Platform.OS === "web") return;

    // Check on mount
    checkForUpdate();

    // Check when app returns to foreground
    const subscription = AppState.addEventListener(
      "change",
      (status: AppStateStatus) => {
        if (status === "active") {
          checkForUpdate();
        }
      },
    );

    return () => subscription.remove();
  }, [checkForUpdate]);

  const applyUpdate = useCallback(async () => {
    if (!__DEV__) {
      await Updates.reloadAsync();
    }
  }, []);

  return {
    ...state,
    checkForUpdate,
    applyUpdate,
  };
}
