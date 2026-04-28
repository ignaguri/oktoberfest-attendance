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

import { APP_STORE_URL } from "@/lib/constants/app-store";
import { logger } from "@/lib/logger";
import {
  incrementAttendanceCount,
  readPromptHistory,
  recordPromptShown,
} from "@/lib/rate-app/storage";

const PROMPT_AT_COUNTS = new Set<number>([3, 10, 30]);
const MIN_DAYS_BETWEEN_PROMPTS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function tryRequestReview(): Promise<boolean> {
  try {
    // hasAction() is a superset of isAvailableAsync() in expo-store-review,
    // so a single check covers both "API present" and "store URL resolvable".
    if (!(await StoreReview.hasAction())) return false;
    await StoreReview.requestReview();
    return true;
  } catch (error) {
    logger.warn("StoreReview.requestReview failed:", { error });
    return false;
  }
}

async function openStoreFallback(): Promise<void> {
  try {
    await Linking.openURL(APP_STORE_URL);
  } catch (error) {
    logger.error("Failed to open store URL fallback:", error);
  }
}

export function useRatePrompt() {
  const recordAttendanceSave = useCallback(async () => {
    try {
      const nextCount = await incrementAttendanceCount();
      if (!PROMPT_AT_COUNTS.has(nextCount)) return;

      const { lastPromptedAt } = await readPromptHistory();
      if (
        lastPromptedAt !== null &&
        (Date.now() - lastPromptedAt) / MS_PER_DAY < MIN_DAYS_BETWEEN_PROMPTS
      ) {
        return;
      }

      const shown = await tryRequestReview();
      if (shown) await recordPromptShown(nextCount);
    } catch (error) {
      logger.warn("recordAttendanceSave failed:", { error });
    }
  }, []);

  const requestReviewManually = useCallback(async () => {
    const shown = await tryRequestReview();
    if (!shown) await openStoreFallback();
  }, []);

  return { recordAttendanceSave, requestReviewManually };
}
