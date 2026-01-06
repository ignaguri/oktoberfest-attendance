import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseISO, isWithinInterval } from "date-fns";

import { supabase } from "@/lib/supabase";

// Festival type (simplified from shared schemas)
export interface Festival {
  id: string;
  name: string;
  short_name: string;
  start_date: string;
  end_date: string;
  beer_cost: number | null;
  location: string;
  map_url: string | null;
  timezone: string;
  is_active: boolean;
  status: "upcoming" | "active" | "ended";
  created_at: string;
  updated_at: string;
}

interface FestivalContextType {
  currentFestival: Festival | null;
  festivals: Festival[];
  setCurrentFestival: (festival: Festival) => void;
  isLoading: boolean;
  error: string | null;
}

const FESTIVAL_STORAGE_KEY = "@prostcounter/selectedFestivalId";

const FestivalContext = createContext<FestivalContextType | undefined>(
  undefined
);

export function FestivalProvider({ children }: { children: ReactNode }) {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [currentFestival, setCurrentFestivalState] = useState<Festival | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          throw new Error(`Error fetching festivals: ${festivalsError.message}`);
        }

        setFestivals((festivalsData as Festival[]) || []);

        // Selection priority: stored > date match > active > most recent
        const storedFestivalId = await AsyncStorage.getItem(FESTIVAL_STORAGE_KEY);
        let selectedFestival: Festival | null = null;

        if (storedFestivalId) {
          selectedFestival =
            festivalsData?.find((f) => f.id === storedFestivalId) || null;
        }

        if (!selectedFestival) {
          const today = new Date();
          selectedFestival =
            festivalsData?.find((f) => {
              const startDate = parseISO(f.start_date);
              const endDate = parseISO(f.end_date);
              return isWithinInterval(today, { start: startDate, end: endDate });
            }) || null;
        }

        if (!selectedFestival) {
          selectedFestival = festivalsData?.find((f) => f.is_active) || null;
        }

        if (!selectedFestival && festivalsData?.length) {
          selectedFestival = festivalsData[0] as Festival;
        }

        if (selectedFestival) {
          setCurrentFestivalState(selectedFestival);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch festivals"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchFestivals();
  }, []);

  const setCurrentFestival = async (festival: Festival) => {
    setCurrentFestivalState(festival);
    await AsyncStorage.setItem(FESTIVAL_STORAGE_KEY, festival.id);
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
