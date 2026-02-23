import type { FestivalStorage } from "@prostcounter/shared/contexts";
import type { Festival } from "@prostcounter/shared/schemas";

const STORAGE_KEY = "selectedFestivalId";
const CACHED_FESTIVAL_KEY = "cachedFestival";

/**
 * Web-specific festival storage using localStorage
 * Handles SSR by checking for window availability
 */
export const webFestivalStorage: FestivalStorage = {
  getSelectedFestivalId: async () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  },
  setSelectedFestivalId: async (id: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  },

  getCachedFestival: async (): Promise<Festival | null> => {
    if (typeof window === "undefined") return null;
    const json = localStorage.getItem(CACHED_FESTIVAL_KEY);
    if (!json) return null;
    try {
      return JSON.parse(json) as Festival;
    } catch {
      return null;
    }
  },

  setCachedFestival: async (festival: Festival): Promise<void> => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CACHED_FESTIVAL_KEY, JSON.stringify(festival));
    }
  },
};
