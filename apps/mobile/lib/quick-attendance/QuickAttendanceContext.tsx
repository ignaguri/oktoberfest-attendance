import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface OpenSheetOptions {
  tentId?: string;
  tentName?: string;
}

interface QuickAttendanceContextType {
  /** Whether the sheet is currently open */
  isOpen: boolean;
  /** Tent ID to preselect when opening */
  preselectedTentId: string | undefined;
  /** Tent name to show (for immediate display before data loads) */
  preselectedTentName: string | undefined;
  /** Open the quick attendance sheet */
  openSheet: (options?: OpenSheetOptions) => void;
  /** Close the quick attendance sheet */
  closeSheet: () => void;
}

const QuickAttendanceContext = createContext<QuickAttendanceContextType | null>(
  null,
);

interface QuickAttendanceProviderProps {
  children: ReactNode;
}

/**
 * Provider for quick attendance sheet state.
 * Allows any component to open the sheet with optional preselected tent.
 */
export function QuickAttendanceProvider({
  children,
}: QuickAttendanceProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [preselectedTentId, setPreselectedTentId] = useState<
    string | undefined
  >();
  const [preselectedTentName, setPreselectedTentName] = useState<
    string | undefined
  >();
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const openSheet = useCallback((options?: OpenSheetOptions) => {
    // Cancel any pending close cleanup
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setPreselectedTentId(options?.tentId);
    setPreselectedTentName(options?.tentName);
    setIsOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setIsOpen(false);
    // Clear any existing timeout to prevent race conditions
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    // Clear preselected values after a delay to allow close animation
    closeTimeoutRef.current = setTimeout(() => {
      setPreselectedTentId(undefined);
      setPreselectedTentName(undefined);
      closeTimeoutRef.current = null;
    }, 300);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      preselectedTentId,
      preselectedTentName,
      openSheet,
      closeSheet,
    }),
    [isOpen, preselectedTentId, preselectedTentName, openSheet, closeSheet],
  );

  return (
    <QuickAttendanceContext.Provider value={value}>
      {children}
    </QuickAttendanceContext.Provider>
  );
}

/**
 * Hook to access the quick attendance context.
 * Must be used within a QuickAttendanceProvider.
 */
export function useQuickAttendance(): QuickAttendanceContextType {
  const context = useContext(QuickAttendanceContext);
  if (!context) {
    throw new Error(
      "useQuickAttendance must be used within a QuickAttendanceProvider",
    );
  }
  return context;
}
