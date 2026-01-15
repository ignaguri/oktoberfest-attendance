import type { FestivalStorage } from "@prostcounter/shared/contexts";

const STORAGE_KEY = "selectedFestivalId";

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
};
