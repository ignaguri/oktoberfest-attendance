/**
 * Mobile-specific festival storage implementation
 *
 * Uses AsyncStorage for persisting the selected festival ID
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { FestivalStorage } from "@prostcounter/shared/contexts";

const STORAGE_KEY = "@prostcounter/selectedFestivalId";

export const mobileFestivalStorage: FestivalStorage = {
  getSelectedFestivalId: () => AsyncStorage.getItem(STORAGE_KEY),
  setSelectedFestivalId: (id) => AsyncStorage.setItem(STORAGE_KEY, id),
};
