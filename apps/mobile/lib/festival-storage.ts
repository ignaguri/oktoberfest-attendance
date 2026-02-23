/**
 * Mobile-specific festival storage implementation
 *
 * Uses AsyncStorage for persisting the selected festival ID
 * and the cached festival object for offline cold start.
 */

import type { FestivalStorage } from "@prostcounter/shared/contexts";
import type { Festival } from "@prostcounter/shared/schemas";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@prostcounter/selectedFestivalId";
const CACHED_FESTIVAL_KEY = "@prostcounter/cachedFestival";

export const mobileFestivalStorage: FestivalStorage = {
  getSelectedFestivalId: () => AsyncStorage.getItem(STORAGE_KEY),
  setSelectedFestivalId: (id) => AsyncStorage.setItem(STORAGE_KEY, id),

  getCachedFestival: async (): Promise<Festival | null> => {
    const json = await AsyncStorage.getItem(CACHED_FESTIVAL_KEY);
    if (!json) return null;
    try {
      return JSON.parse(json) as Festival;
    } catch {
      return null;
    }
  },

  setCachedFestival: async (festival: Festival): Promise<void> => {
    await AsyncStorage.setItem(CACHED_FESTIVAL_KEY, JSON.stringify(festival));
  },
};
