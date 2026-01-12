import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFestivals } from "@prostcounter/shared/hooks";
import { parseISO } from "date-fns";

// Festival type matching the API response (camelCase)
export interface Festival {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  beerCost: number | null;
  location: string | null;
  mapUrl: string | null;
  isActive: boolean;
  status: "upcoming" | "active" | "ended";
  timezone: string | null;
  createdAt: string;
  updatedAt: string;
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
  const [currentFestival, setCurrentFestivalState] = useState<Festival | null>(
    null
  );
  const [storedFestivalId, setStoredFestivalId] = useState<string | null>(null);

  // Load stored festival ID on mount
  useEffect(() => {
    AsyncStorage.getItem(FESTIVAL_STORAGE_KEY).then((id) => {
      setStoredFestivalId(id);
    });
  }, []);

  // Fetch festivals using the useFestivals hook
  const { data: festivalsData, loading: isLoading, error: queryError } = useFestivals();

  const festivals: Festival[] = festivalsData || [];

  // Select current festival based on priority
  useEffect(() => {
    if (!festivalsData || festivalsData.length === 0) return;

    let selectedFestival: Festival | null = null;

    // Priority 1: Stored festival ID
    if (storedFestivalId) {
      selectedFestival =
        festivalsData.find((f: Festival) => f.id === storedFestivalId) || null;
    }

    // Priority 2: Currently active festival (by date)
    // Use parseISO to avoid UTC timezone issues with date-only strings
    if (!selectedFestival) {
      const today = new Date();
      selectedFestival =
        festivalsData.find((f: Festival) => {
          const start = parseISO(f.startDate);
          const end = parseISO(f.endDate);
          return today >= start && today <= end;
        }) || null;
    }

    // Priority 3: Festival marked as active
    if (!selectedFestival) {
      selectedFestival = festivalsData.find((f: Festival) => f.isActive) || null;
    }

    // Priority 4: Most recent festival
    if (!selectedFestival && festivalsData.length > 0) {
      selectedFestival = festivalsData[0];
    }

    if (selectedFestival) {
      setCurrentFestivalState(selectedFestival);
    }
  }, [festivalsData, storedFestivalId]);

  const setCurrentFestival = async (festival: Festival) => {
    setCurrentFestivalState(festival);
    await AsyncStorage.setItem(FESTIVAL_STORAGE_KEY, festival.id);
  };

  const error = queryError?.message || null;

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
