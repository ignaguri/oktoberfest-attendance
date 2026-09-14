"use client";

/**
 * Shared FestivalContext
 *
 * Provides the current festival selection across the app.
 * Uses platform-specific storage via FestivalStorage interface.
 *
 * Supports offline cold start: when the API fails to load festivals
 * (e.g. device is offline), falls back to a cached festival object
 * stored in platform-specific storage.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useFestivals } from "../../hooks/useFestivals";
import type { Festival } from "../../schemas/festival.schema";
import { getSwitchSuggestion, selectFestival } from "./selection-logic";
import type { FestivalContextType, FestivalStorage } from "./types";

const FestivalContext = createContext<FestivalContextType | undefined>(undefined);

interface FestivalProviderProps {
  children: ReactNode;
  /** Platform-specific storage implementation */
  storage: FestivalStorage;
}

export function FestivalProvider({ children, storage }: FestivalProviderProps) {
  const [currentFestival, setCurrentFestivalState] = useState<Festival | null>(null);
  const [storedFestivalId, setStoredFestivalId] = useState<string | null>(null);
  const [cachedFestival, setCachedFestivalState] = useState<Festival | null>(null);
  const [dismissedSuggestionId, setDismissedSuggestionId] = useState<string | null>(null);
  const [switchSuggestion, setSwitchSuggestion] = useState<Festival | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);

  // Track whether we have already applied the cache fallback to avoid
  // re-applying it if the API later succeeds
  const cacheAppliedRef = useRef(false);

  // The suggestion is judged once per session, against the festival restored on
  // launch. A refetch must not re-offer it after the user has changed festival.
  const suggestionEvaluatedRef = useRef(false);

  // Load stored festival ID, cached festival and dismissed suggestion on mount
  useEffect(() => {
    let mounted = true;

    Promise.all([
      storage.getSelectedFestivalId(),
      storage.getCachedFestival(),
      storage.getDismissedSuggestionId(),
    ]).then(([id, cached, dismissedId]) => {
      if (mounted) {
        setStoredFestivalId(id);
        setCachedFestivalState(cached);
        setDismissedSuggestionId(dismissedId);
        setStorageLoaded(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, [storage]);

  // Fetch festivals using the shared hook (React Query caching)
  const { data: festivalsData, loading: isLoadingFestivals, error: queryError } = useFestivals();

  const festivals: Festival[] = useMemo(() => festivalsData || [], [festivalsData]);

  // Select current festival based on priority when data changes
  useEffect(() => {
    if (!storageLoaded || !festivalsData || festivalsData.length === 0) {
      return;
    }

    const selected = selectFestival(festivalsData, storedFestivalId);
    if (selected) {
      setCurrentFestivalState(selected);
      // Update the cache whenever we select a festival from fresh API data
      storage.setCachedFestival(selected);
      cacheAppliedRef.current = false; // Reset since we have live data

      if (!suggestionEvaluatedRef.current) {
        suggestionEvaluatedRef.current = true;
        setSwitchSuggestion(getSwitchSuggestion(festivalsData, selected, dismissedSuggestionId));
      }
    }
  }, [festivalsData, storedFestivalId, dismissedSuggestionId, storageLoaded, storage]);

  // Fallback: use cached festival when API returns no data (offline cold start)
  useEffect(() => {
    if (!storageLoaded || isLoadingFestivals) {
      return;
    }

    // Only apply fallback if API returned no data AND we have no current festival
    const apiHasNoData = !festivalsData || festivalsData.length === 0;
    if (apiHasNoData && !currentFestival && cachedFestival && !cacheAppliedRef.current) {
      setCurrentFestivalState(cachedFestival);
      cacheAppliedRef.current = true;
    }
  }, [storageLoaded, isLoadingFestivals, festivalsData, currentFestival, cachedFestival]);

  // Handler to change the current festival
  const setCurrentFestival = useCallback(
    async (festival: Festival) => {
      setCurrentFestivalState(festival);
      // Keep the selection effect in step, or a festivals refetch would restore
      // the id read on launch and undo this change
      setStoredFestivalId(festival.id);
      // Any explicit change supersedes the launch-time suggestion
      setSwitchSuggestion(null);
      await storage.setSelectedFestivalId(festival.id);
      // Also cache the full festival object for offline fallback
      await storage.setCachedFestival(festival);
    },
    [storage],
  );

  const dismissSwitchSuggestion = useCallback(() => {
    setSwitchSuggestion((suggestion) => {
      if (suggestion) {
        storage.setDismissedSuggestionId(suggestion.id);
      }
      return null;
    });
  }, [storage]);

  const clearSwitchSuggestion = useCallback(() => {
    setSwitchSuggestion(null);
  }, []);

  const error = queryError?.message || null;
  const isLoading = isLoadingFestivals || !storageLoaded;

  const value = useMemo<FestivalContextType>(
    () => ({
      currentFestival,
      festivals,
      setCurrentFestival,
      switchSuggestion,
      dismissSwitchSuggestion,
      clearSwitchSuggestion,
      isLoading,
      error,
    }),
    [
      currentFestival,
      festivals,
      setCurrentFestival,
      switchSuggestion,
      dismissSwitchSuggestion,
      clearSwitchSuggestion,
      isLoading,
      error,
    ],
  );

  return <FestivalContext.Provider value={value}>{children}</FestivalContext.Provider>;
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
      switchSuggestion: null,
      dismissSwitchSuggestion: () => {},
      clearSwitchSuggestion: () => {},
      isLoading: false,
      error: null,
    };
  }
  return context;
}

/**
 * Whether other launch popups (install banner, update and permission prompts)
 * may open. They wait for the festival switch prompt, which changes what the
 * user sees and so goes first instead of stacking with them.
 *
 * They also wait for a festival to be selected, because the suggestion is only
 * known then. currentFestival and switchSuggestion are set in the same effect,
 * so there is no render in between. With no festivals at all they must not wait
 * forever.
 */
export function useCanShowLaunchPopups(): boolean {
  const { currentFestival, festivals, isLoading, switchSuggestion } = useFestival();
  const isFestivalSettled = !!currentFestival || (!isLoading && festivals.length === 0);
  return isFestivalSettled && !switchSuggestion;
}
