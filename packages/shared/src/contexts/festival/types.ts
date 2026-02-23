/**
 * Types for FestivalContext
 *
 * Provides storage abstraction to allow platform-specific implementations
 * (localStorage for web, AsyncStorage for mobile)
 */

import type { Festival } from "../../schemas/festival.schema";

/**
 * Storage interface for persisting selected festival ID and cached festival data
 * Implementations are platform-specific (localStorage vs AsyncStorage)
 */
export interface FestivalStorage {
  getSelectedFestivalId: () => Promise<string | null>;
  setSelectedFestivalId: (id: string) => Promise<void>;
  /** Retrieve the cached full festival object (for offline cold start) */
  getCachedFestival: () => Promise<Festival | null>;
  /** Cache the full festival object for offline fallback */
  setCachedFestival: (festival: Festival) => Promise<void>;
}

/**
 * FestivalContext value type
 */
export interface FestivalContextType {
  /** Currently selected festival */
  currentFestival: Festival | null;
  /** All available festivals */
  festivals: Festival[];
  /** Function to change the current festival */
  setCurrentFestival: (festival: Festival) => void;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
}
