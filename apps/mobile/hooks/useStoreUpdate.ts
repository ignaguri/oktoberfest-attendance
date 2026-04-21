import * as Application from "expo-application";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppStateStatus } from "react-native";
import { AppState, Platform } from "react-native";

import { IOS_APP_STORE_URL } from "@/lib/constants/app-store";
import { logger } from "@/lib/logger";

/** Minimum interval between store version checks (1 hour). */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function isNewerVersion(currentVersion: string, storeVersion: string): boolean {
  const current = currentVersion.split(".").map(Number);
  const store = storeVersion.split(".").map(Number);

  for (let i = 0; i < Math.max(current.length, store.length); i++) {
    const c = current[i] ?? 0;
    const s = store[i] ?? 0;
    if (s > c) return true;
    if (s < c) return false;
  }
  return false;
}

async function fetchAppStoreVersion(): Promise<string | null> {
  const bundleId = Application.applicationId;
  if (!bundleId) return null;

  try {
    const response = await fetch(
      `https://itunes.apple.com/lookup?bundleId=${bundleId}`,
    );
    if (!response.ok) {
      logger.error(`App Store lookup failed: ${response.status}`);
      return null;
    }
    const data = await response.json();
    if (data.resultCount > 0 && data.results[0]?.version) {
      return data.results[0].version as string;
    }
    return null;
  } catch (error) {
    logger.error("Failed to fetch App Store version:", error);
    return null;
  }
}

/**
 * Checks whether a newer version of the app is available on the App Store.
 *
 * Includes a 1-hour throttle between checks and skips entirely in __DEV__ mode
 * or on non-iOS platforms.
 */
export function useStoreUpdate() {
  const [isStoreUpdateAvailable, setIsStoreUpdateAvailable] = useState(false);

  const isCheckingRef = useRef(false);
  const lastCheckRef = useRef(0);

  const checkForStoreUpdate = useCallback(async () => {
    if (__DEV__ || Platform.OS !== "ios") return;
    if (isCheckingRef.current) return;
    if (isStoreUpdateAvailable) return;

    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_INTERVAL_MS) return;

    isCheckingRef.current = true;
    lastCheckRef.current = now;

    try {
      const currentVersion = Application.nativeApplicationVersion;
      if (!currentVersion) return;

      const storeVersion = await fetchAppStoreVersion();
      if (storeVersion && isNewerVersion(currentVersion, storeVersion)) {
        logger.info(
          `Store update available: ${currentVersion} → ${storeVersion}`,
        );
        setIsStoreUpdateAvailable(true);
      }
    } catch (error) {
      logger.error("Error checking store version:", error);
    } finally {
      isCheckingRef.current = false;
    }
  }, [isStoreUpdateAvailable]);

  useEffect(() => {
    if (__DEV__ || Platform.OS !== "ios") return;

    checkForStoreUpdate();

    const subscription = AppState.addEventListener(
      "change",
      (status: AppStateStatus) => {
        if (status === "active") {
          checkForStoreUpdate();
        }
      },
    );

    return () => subscription.remove();
  }, [checkForStoreUpdate]);

  const openStore = useCallback(async () => {
    try {
      await Linking.openURL(IOS_APP_STORE_URL);
    } catch (error) {
      logger.error("Failed to open App Store URL:", error);
    }
  }, []);

  return {
    isStoreUpdateAvailable,
    openStore,
  };
}
