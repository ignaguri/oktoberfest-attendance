/**
 * Remembers which festivals the user folded the "Bring your groups" card for,
 * so it stays a one-line header on the Groups tab instead of reopening on
 * every visit.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { logger } from "@/lib/logger";

const COLLAPSED_KEY = "@prostcounter/carry-over/collapsed-festivals";

async function readCollapsedFestivals(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(COLLAPSED_KEY);
    const festivalIds: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(festivalIds) ? festivalIds : [];
  } catch (error) {
    logger.warn("Failed to read carry-over collapse state:", { error });
    return [];
  }
}

export async function isCarryOverCollapsed(festivalId: string): Promise<boolean> {
  return (await readCollapsedFestivals()).includes(festivalId);
}

export async function setCarryOverCollapsed(festivalId: string, collapsed: boolean): Promise<void> {
  const others = (await readCollapsedFestivals()).filter((id) => id !== festivalId);
  try {
    await AsyncStorage.setItem(
      COLLAPSED_KEY,
      JSON.stringify(collapsed ? [...others, festivalId] : others),
    );
  } catch (error) {
    logger.warn("Failed to save carry-over collapse state:", { error });
  }
}
