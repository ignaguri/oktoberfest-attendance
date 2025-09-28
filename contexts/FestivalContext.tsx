"use client";

import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { parseISO, isWithinInterval } from "date-fns";
import { createContext, useContext, useEffect, useState } from "react";

import type { Festival } from "@/lib/types";
import type { ReactNode } from "react";

interface FestivalContextType {
  currentFestival: Festival | null;
  festivals: Festival[];
  setCurrentFestival: (festival: Festival) => void;
  isLoading: boolean;
  error: string | null;
}

const FestivalContext = createContext<FestivalContextType | undefined>(
  undefined,
);

interface FestivalProviderProps {
  children: ReactNode;
}

export function FestivalProvider({ children }: FestivalProviderProps) {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [currentFestival, setCurrentFestivalState] = useState<Festival | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    const fetchFestivals = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data: festivalsData, error: festivalsError } = await supabase
          .from("festivals")
          .select("*")
          .order("start_date", { ascending: false });

        if (festivalsError) {
          throw new Error(
            `Error fetching festivals: ${festivalsError.message}`,
          );
        }

        setFestivals(festivalsData || []);

        // Set current festival based on priority:
        // 1. Previously selected festival from localStorage
        // 2. Festival that matches current date (auto-selection by dates)
        // 3. Active festival (is_active = true)
        // 4. Most recent festival by start_date
        const storedFestivalId = localStorage.getItem("selectedFestivalId");
        let selectedFestival: Festival | null = null;

        if (storedFestivalId) {
          selectedFestival =
            festivalsData?.find((f: Festival) => f.id === storedFestivalId) ||
            null;
        }

        if (!selectedFestival) {
          // Auto-select festival based on current date
          const today = new Date();
          selectedFestival =
            festivalsData?.find((f: Festival) => {
              const startDate = parseISO(f.start_date);
              const endDate = parseISO(f.end_date);
              return isWithinInterval(today, {
                start: startDate,
                end: endDate,
              });
            }) || null;
        }

        if (!selectedFestival) {
          // Find active festival
          selectedFestival =
            festivalsData?.find((f: Festival) => f.is_active) || null;
        }

        if (!selectedFestival && festivalsData && festivalsData.length > 0) {
          // Default to most recent festival
          selectedFestival = festivalsData[0];
        }

        if (selectedFestival) {
          setCurrentFestivalState(selectedFestival);
          console.log(
            "FestivalContext - Selected festival:",
            selectedFestival.id,
            selectedFestival.name,
          );
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch festivals",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchFestivals();
  }, [supabase]);

  const setCurrentFestival = (festival: Festival) => {
    setCurrentFestivalState(festival);
    localStorage.setItem("selectedFestivalId", festival.id);
  };

  return (
    <FestivalContext.Provider
      value={{
        currentFestival,
        festivals,
        setCurrentFestival,
        isLoading,
        error,
      }}
    >
      {children}
    </FestivalContext.Provider>
  );
}

export function useFestival() {
  const context = useContext(FestivalContext);
  if (context === undefined) {
    throw new Error("useFestival must be used within a FestivalProvider");
  }
  return context;
}
