/**
 * Rate-the-app prompt logic.
 *
 * Exposes two actions:
 *  - recordAttendanceSave(): increments the saved-attendance counter and, if
 *    the user has hit one of the milestone counts and 14+ days have passed
 *    since the last prompt, fires the platform's native review API.
 *  - requestReviewManually(): always asks the platform to show its review UI
 *    (used by the "Rate the app" button in the profile). Falls back to
 *    opening the store URL if the in-app API isn't available.
 *
 * The native review APIs (SKStoreReviewController on iOS, In-App Review on
 * Android) handle their own quotas — we cannot reliably know whether the
 * dialog actually displayed.
 */

import * as Linking from "expo-linking";
import * as StoreReview from "expo-store-review";
import { useCallback } from "react";
import { Platform } from "react-native";

import {
  ANDROID_PLAY_STORE_URL,
  IOS_APP_STORE_URL,
} from "@/lib/constants/app-store";
import { logger } from "@/lib/logger";

import {
  incrementAttendanceCount,
  readRatePromptState,
  recordPromptShown,
} from "./storage";

const PROMPT_AT_COUNTS = [3, 10, 30] as const;
const MIN_DAYS_BETWEEN_PROMPTS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function tryRequestReview(): Promise<boolean> {
  try {
    const available = await StoreReview.isAvailableAsync();
    if (!available) return false;

    const hasAction = await StoreReview.hasAction();
    if (!hasAction) return false;

    await StoreReview.requestReview();
    return true;
  } catch (error) {
    logger.warn("StoreReview.requestReview failed:", { error });
    return false;
  }
}

async function openStoreFallback(): Promise<void> {
  const url = Platform.select({
    ios: IOS_APP_STORE_URL,
    android: ANDROID_PLAY_STORE_URL,
    default: IOS_APP_STORE_URL,
  });

  try {
    await Linking.openURL(url);
  } catch (error) {
    logger.error("Failed to open store URL fallback:", error);
  }
}

export function useRatePrompt() {
  const recordAttendanceSave = useCallback(async () => {
    try {
      const nextCount = await incrementAttendanceCount();

      if (!(PROMPT_AT_COUNTS as readonly number[]).includes(nextCount)) {
        return;
      }

      const { lastPromptedAt, lastPromptedCount } = await readRatePromptState();

      if (nextCount <= lastPromptedCount) return;

      if (lastPromptedAt !== null) {
        const daysSince = (Date.now() - lastPromptedAt) / MS_PER_DAY;
        if (daysSince < MIN_DAYS_BETWEEN_PROMPTS) return;
      }

      const shown = await tryRequestReview();
      if (shown) {
        await recordPromptShown(nextCount);
      }
    } catch (error) {
      logger.warn("recordAttendanceSave failed:", { error });
    }
  }, []);

  const requestReviewManually = useCallback(async () => {
    const shown = await tryRequestReview();
    if (!shown) {
      await openStoreFallback();
    }
  }, []);

  return { recordAttendanceSave, requestReviewManually };
}
