import * as Application from "expo-application";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppStateStatus } from "react-native";
import { AppState, Platform } from "react-native";

import { API_BASE_URL } from "@/lib/api-client";
import { APP_STORE_URL } from "@/lib/constants/app-store";
import { logger } from "@/lib/logger";
import { isNewerVersion } from "@/lib/version";

/** Minimum interval between version checks (1 hour). */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Platforms that have a store to send someone to. */
type StorePlatform = "ios" | "android";

interface PublishedVersion {
  latest: string;
  minSupported: string;
}

function currentStorePlatform(): StorePlatform | null {
  return Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;
}

/**
 * Reads published versions from our API (replaces the iOS-only iTunes lookup).
 * Returns null on any failure, so a network blip reads as "no update".
 */
async function fetchPublishedVersion(platform: StorePlatform): Promise<PublishedVersion | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/app-version`);
    if (!response.ok) {
      logger.error(`App version lookup failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const entry = data?.[platform];

    // Bail here rather than in isNewerVersion, so the reason lands in the logs.
    if (typeof entry?.latest !== "string" || typeof entry?.minSupported !== "string") {
      logger.error("App version payload missing fields for platform", undefined, { platform });
      return null;
    }

    return { latest: entry.latest, minSupported: entry.minSupported };
  } catch (error) {
    logger.error("Failed to fetch published app version:", error);
    return null;
  }
}

/**
 * Checks for a published update, throttled to once an hour. `isBelowMinimum`
 * marks builds the backend rejects outright, as opposed to merely outdated.
 */
export function useStoreUpdate() {
  const [isStoreUpdateAvailable, setIsStoreUpdateAvailable] = useState(false);
  const [isBelowMinimum, setIsBelowMinimum] = useState(false);

  const isCheckingRef = useRef(false);
  const lastCheckRef = useRef(0);

  const checkForStoreUpdate = useCallback(async () => {
    const platform = currentStorePlatform();
    if (__DEV__ || !platform) return;
    if (isCheckingRef.current) return;
    if (isStoreUpdateAvailable) return;

    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_INTERVAL_MS) return;

    isCheckingRef.current = true;
    lastCheckRef.current = now;

    try {
      const currentVersion = Application.nativeApplicationVersion;
      if (!currentVersion) return;

      const published = await fetchPublishedVersion(platform);
      if (!published) return;

      if (isNewerVersion(currentVersion, published.latest)) {
        logger.info(`Store update available: ${currentVersion} → ${published.latest}`);
        setIsStoreUpdateAvailable(true);
      }

      if (isNewerVersion(currentVersion, published.minSupported)) {
        logger.info(`Build is below the supported floor: ${currentVersion} < ${published.minSupported}`);
        setIsBelowMinimum(true);
      }
    } catch (error) {
      logger.error("Error checking published version:", error);
    } finally {
      isCheckingRef.current = false;
    }
  }, [isStoreUpdateAvailable]);

  useEffect(() => {
    if (__DEV__ || !currentStorePlatform()) return;

    checkForStoreUpdate();

    const subscription = AppState.addEventListener("change", (status: AppStateStatus) => {
      if (status === "active") {
        checkForStoreUpdate();
      }
    });

    return () => subscription.remove();
  }, [checkForStoreUpdate]);

  const openStore = useCallback(async () => {
    try {
      await Linking.openURL(APP_STORE_URL);
    } catch (error) {
      logger.error("Failed to open store URL:", error);
    }
  }, []);

  return {
    isStoreUpdateAvailable,
    isBelowMinimum,
    openStore,
  };
}
