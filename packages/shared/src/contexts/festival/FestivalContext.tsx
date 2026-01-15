"use client";

/**
 * Shared FestivalContext
 *
 * Provides the current festival selection across the app.
 * Uses platform-specific storage via FestivalStorage interface.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useFestivals } from "../../hooks/useFestivals";
import type { Festival } from "../../schemas/festival.schema";
import { selectFestival } from "./selection-logic";
import type { FestivalContextType, FestivalStorage } from "./types";

const FestivalContext = createContext<FestivalContextType | undefined>(
  undefined,
);

interface FestivalProviderProps {
  children: ReactNode;
  /** Platform-specific storage implementation */
  storage: FestivalStorage;
}

export function FestivalProvider({ children, storage }: FestivalProviderProps) {
  const [currentFestival, setCurrentFestivalState] = useState<Festival | null>(
    null,
  );
  const [storedFestivalId, setStoredFestivalId] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);

  // Load stored festival ID on mount
  useEffect(() => {
    let mounted = true;

    storage.getSelectedFestivalId().then((id) => {
      if (mounted) {
        setStoredFestivalId(id);
        setStorageLoaded(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, [storage]);

  // Fetch festivals using the shared hook (React Query caching)
  const {
    data: festivalsData,
    loading: isLoadingFestivals,
    error: queryError,
  } = useFestivals();

  const festivals: Festival[] = useMemo(
    () => festivalsData || [],
    [festivalsData],
  );

  // Select current festival based on priority when data changes
  useEffect(() => {
    if (!storageLoaded || !festivalsData || festivalsData.length === 0) {
      return;
    }

    const selected = selectFestival(festivalsData, storedFestivalId);
    if (selected) {
      setCurrentFestivalState(selected);
    }
  }, [festivalsData, storedFestivalId, storageLoaded]);

  // Handler to change the current festival
  const setCurrentFestival = useCallback(
    async (festival: Festival) => {
      setCurrentFestivalState(festival);
      await storage.setSelectedFestivalId(festival.id);
    },
    [storage],
  );

  const error = queryError?.message || null;
  const isLoading = isLoadingFestivals || !storageLoaded;

  const value = useMemo<FestivalContextType>(
    () => ({
      currentFestival,
      festivals,
      setCurrentFestival,
      isLoading,
      error,
    }),
    [currentFestival, festivals, setCurrentFestival, isLoading, error],
  );

  return (
    <FestivalContext.Provider value={value}>
      {children}
    </FestivalContext.Provider>
  );
}

/**
 * Hook to access the FestivalContext
 * Throws an error if used outside of FestivalProvider
 */
export function useFestival(): FestivalContextType {
  const context = useContext(FestivalContext);
  if (context === undefined) {
    throw new Error("useFestival must be used within a FestivalProvider");
  }
  return context;
}

/**
 * Safe version of useFestival that returns default values if used outside provider
 * Useful for components that may render before auth (public pages)
 */
export function useFestivalSafe(): FestivalContextType {
  const context = useContext(FestivalContext);
  if (context === undefined) {
    return {
      currentFestival: null,
      festivals: [],
      setCurrentFestival: () => {},
      isLoading: false,
      error: null,
    };
  }
  return context;
}
