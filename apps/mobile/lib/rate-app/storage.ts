/**
 * AsyncStorage helpers for rate-prompt gating state.
 *
 * Tracks total successful attendance saves and the timestamp / count at the
 * last review-API call so the prompt can throttle itself at the milestones
 * defined in useRatePrompt.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { logger } from "@/lib/logger";

const ATTENDANCE_COUNT_KEY = "@prostcounter/rate-prompt/attendanceCount";
const LAST_PROMPTED_AT_KEY = "@prostcounter/rate-prompt/lastPromptedAt";
const LAST_PROMPTED_COUNT_KEY = "@prostcounter/rate-prompt/lastPromptedCount";

export interface PromptHistory {
  lastPromptedAt: number | null;
  lastPromptedCount: number;
}

/**
 * Hot path: a single getItem + setItem on every successful attendance save.
 * Prompt history is intentionally NOT read here — most calls early-return on
 * the milestone check, and the extra two reads only matter ~3 times per
 * user lifetime (see readPromptHistory).
 */
export async function incrementAttendanceCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(ATTENDANCE_COUNT_KEY);
    const next = parseIntOrZero(raw) + 1;
    await AsyncStorage.setItem(ATTENDANCE_COUNT_KEY, String(next));
    return next;
  } catch (error) {
    logger.warn("Failed to increment attendance count:", { error });
    return 0;
  }
}

export async function readPromptHistory(): Promise<PromptHistory> {
  try {
    const [promptedAt, promptedCount] = await Promise.all([
      AsyncStorage.getItem(LAST_PROMPTED_AT_KEY),
      AsyncStorage.getItem(LAST_PROMPTED_COUNT_KEY),
    ]);

    return {
      lastPromptedAt: promptedAt ? parseIntOrNull(promptedAt) : null,
      lastPromptedCount: parseIntOrZero(promptedCount),
    };
  } catch (error) {
    logger.warn("Failed to read prompt history:", { error });
    return { lastPromptedAt: null, lastPromptedCount: 0 };
  }
}

export async function recordPromptShown(
  attendanceCount: number,
): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(LAST_PROMPTED_AT_KEY, String(Date.now())),
    AsyncStorage.setItem(LAST_PROMPTED_COUNT_KEY, String(attendanceCount)),
  ]);
}

function parseIntOrZero(value: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseIntOrNull(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
