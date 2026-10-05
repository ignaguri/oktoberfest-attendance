import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef } from "react";
import type { AppStateStatus } from "react-native";
import { AppState, Platform } from "react-native";

import { logger } from "@/lib/logger";

/** Minimum interval between update checks (5 minutes). */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** An update that lands this soon after a session starts reloads immediately. */
const SESSION_START_WINDOW_MS = 10 * 1000;

/**
 * Time in background after which a resume counts as a fresh session. Short
 * trips out (the Android system camera backgrounds the app) must not reload,
 * or the photo the user is picking is lost.
 */
const FRESH_SESSION_BACKGROUND_MS = 5 * 60 * 1000;

/**
 * Checks for EAS OTA updates on launch and on foreground, downloads them
 * silently, and reloads the app at a moment where nothing is in progress:
 *
 * - right away, if the download finishes within a few seconds of a session start
 * - otherwise on the next resume after a long background
 *
 * A downloaded update that never hits either case still applies on the next
 * cold start (expo-updates launches the newest downloaded bundle).
 *
 * Includes a 5-minute throttle between checks and an in-progress guard
 * to prevent concurrent or excessive API calls.
 *
 * Skips entirely in __DEV__ mode (expo-updates is not active in dev client).
 */
export function useAppUpdate() {
  const isCheckingRef = useRef(false);
  const lastCheckRef = useRef(0);
  const isUpdateReadyRef = useRef(false);
  const sessionStartedAtRef = useRef(0);
  const backgroundedAtRef = useRef<number | null>(null);

  const reload = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch (error) {
      logger.error("Error applying update:", error);
    }
  }, []);

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
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) {
        return;
      }

      await Updates.fetchUpdateAsync();
      isUpdateReadyRef.current = true;

      if (Date.now() - sessionStartedAtRef.current < SESSION_START_WINDOW_MS) {
        await reload();
      }
    } catch (error) {
      logger.error("Error checking for update:", error);
    } finally {
      isCheckingRef.current = false;
    }
  }, [reload]);

  useEffect(() => {
    if (__DEV__ || Platform.OS === "web") return;

    // Check on mount
    sessionStartedAtRef.current = Date.now();
    checkForUpdate();

    const subscription = AppState.addEventListener("change", (status: AppStateStatus) => {
      if (status === "background") {
        backgroundedAtRef.current = Date.now();
        // Leaving the app ends the immediate-reload window. A fetch that finishes
        // after a short trip out (system camera) must not reload; only a long
        // background below opens a new window.
        sessionStartedAtRef.current = 0;
        return;
      }
      if (status !== "active") {
        return;
      }

      const backgroundedAt = backgroundedAtRef.current;
      backgroundedAtRef.current = null;
      const isFreshSession =
        backgroundedAt !== null && Date.now() - backgroundedAt >= FRESH_SESSION_BACKGROUND_MS;

      if (isFreshSession) {
        sessionStartedAtRef.current = Date.now();
        if (isUpdateReadyRef.current) {
          reload();
          return;
        }
      }

      checkForUpdate();
    });

    return () => subscription.remove();
  }, [checkForUpdate, reload]);
}
