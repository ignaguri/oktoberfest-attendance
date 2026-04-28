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

export interface RatePromptState {
  attendanceCount: number;
  lastPromptedAt: number | null;
  lastPromptedCount: number;
}

export async function readRatePromptState(): Promise<RatePromptState> {
  try {
    const [count, promptedAt, promptedCount] = await Promise.all([
      AsyncStorage.getItem(ATTENDANCE_COUNT_KEY),
      AsyncStorage.getItem(LAST_PROMPTED_AT_KEY),
      AsyncStorage.getItem(LAST_PROMPTED_COUNT_KEY),
    ]);

    return {
      attendanceCount: parseIntOrZero(count),
      lastPromptedAt: promptedAt ? parseIntOrNull(promptedAt) : null,
      lastPromptedCount: parseIntOrZero(promptedCount),
    };
  } catch (error) {
    logger.warn("Failed to read rate prompt state:", { error });
    return { attendanceCount: 0, lastPromptedAt: null, lastPromptedCount: 0 };
  }
}

export async function incrementAttendanceCount(): Promise<number> {
  const state = await readRatePromptState();
  const next = state.attendanceCount + 1;
  await AsyncStorage.setItem(ATTENDANCE_COUNT_KEY, String(next));
  return next;
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
