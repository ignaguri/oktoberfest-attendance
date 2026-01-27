import * as Updates from "expo-updates";
import { useCallback, useEffect, useState } from "react";
import type { AppStateStatus } from "react-native";
import { AppState, Platform } from "react-native";

interface AppUpdateState {
  isChecking: boolean;
  isDownloading: boolean;
  isUpdateReady: boolean;
  error: Error | null;
}

/**
 * Checks for EAS OTA updates when the app comes to the foreground.
 *
 * When an update is found, it is downloaded silently. Once ready,
 * `isUpdateReady` becomes true so the UI can prompt the user to restart.
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

  const checkForUpdate = useCallback(async () => {
    if (__DEV__ || Platform.OS === "web") return;

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
      setState((prev) => ({
        ...prev,
        isChecking: false,
        isDownloading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
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
