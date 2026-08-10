/**
 * Persistence for the attendance tab's view mode (strip vs list).
 *
 * Mirrors the shape of lib/festival-storage.ts, including the "@prostcounter/"
 * key convention.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@prostcounter/attendanceViewMode";

export type AttendanceViewMode = "calendar" | "list";

export const DEFAULT_ATTENDANCE_VIEW_MODE: AttendanceViewMode = "calendar";

export async function getAttendanceViewMode(): Promise<AttendanceViewMode> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored === "list" || stored === "calendar" ? stored : DEFAULT_ATTENDANCE_VIEW_MODE;
}

export async function setAttendanceViewMode(mode: AttendanceViewMode): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, mode);
}
