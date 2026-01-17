/**
 * Offline Data Provider
 *
 * Provides offline-first data capabilities to the mobile app:
 * - Initializes and manages SQLite database
 * - Creates and exposes SyncManager for data synchronization
 * - Tracks network status and triggers syncs on reconnection
 * - Provides sync state and controls to child components
 */

import type { NetInfoState } from "@react-native-community/netinfo";
import NetInfo from "@react-native-community/netinfo";
import type * as SQLite from "expo-sqlite";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { AppStateStatus } from "react-native";
import { AppState, Platform } from "react-native";

import { initializeDatabase } from "./init";
import type { SyncManager } from "./sync-manager";
import {
  createSyncManager,
  type SyncOptions,
  type SyncResult,
} from "./sync-manager";
import { getQueueStats } from "./sync-queue";

// =============================================================================
// Types
// =============================================================================

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

export interface OfflineContextType {
  /** Whether the database is initialized and ready */
  isReady: boolean;
  /** Whether the device is currently online */
  isOnline: boolean;
  /** Current sync status */
  syncStatus: SyncStatus;
  /** Last sync result (if any) */
  lastSyncResult: SyncResult | null;
  /** Number of pending operations in the sync queue */
  pendingCount: number;
  /** Last time a sync was completed */
  lastSyncAt: Date | null;
  /** Error message if sync failed */
  error: string | null;
  /** Trigger a manual sync */
  sync: (options?: SyncOptions) => Promise<SyncResult>;
  /** Abort any in-progress sync */
  abortSync: () => void;
  /** Get the database instance (throws if not ready) */
  getDb: () => SQLite.SQLiteDatabase;
  /** Get the SyncManager instance (throws if not ready) */
  getSyncManager: () => SyncManager;
  /** Refresh pending count from database */
  refreshPendingCount: () => Promise<void>;
  /** Whether offline mode is being simulated (for testing) */
  isSimulatingOffline: boolean;
  /** Toggle simulated offline mode (for testing) */
  setSimulateOffline: (value: boolean) => void;
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum time between automatic syncs (5 minutes) */
const MIN_SYNC_INTERVAL = 5 * 60 * 1000;

/** Delay before syncing after coming online (2 seconds) */
const ONLINE_SYNC_DELAY = 2000;

// =============================================================================
// Context
// =============================================================================

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

// =============================================================================
// Provider Component
// =============================================================================

interface OfflineDataProviderProps {
  children: ReactNode;
  /** Festival ID for scoped sync (required for user data) */
  festivalId?: string;
  /** User ID for user-scoped data */
  userId?: string;
  /** Disable automatic sync on app foreground */
  disableAutoSync?: boolean;
}

export function OfflineDataProvider({
  children,
  festivalId,
  userId,
  disableAutoSync = false,
}: OfflineDataProviderProps) {
  // State
  const [isReady, setIsReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [simulateOffline, setSimulateOffline] = useState(false);

  // Effective online status (respects simulation for testing)
  const effectiveIsOnline = isOnline && !simulateOffline;
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs for stable references
  const syncManagerRef = useRef<SyncManager | null>(null);
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Initialize database on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        console.log("[OfflineProvider] Initializing database...");
        const db = await initializeDatabase();

        if (!mounted) {
          // Don't close the database - React Strict Mode will remount
          // and the new instance needs the database connection
          console.log(
            "[OfflineProvider] Unmounted during init, skipping setup",
          );
          return;
        }

        dbRef.current = db;
        syncManagerRef.current = createSyncManager(db);

        // Get initial pending count
        const stats = await getQueueStats(db);
        if (mounted) {
          setPendingCount(stats.pending + stats.failed);
          setIsReady(true);
          console.log("[OfflineProvider] Database ready");
        }
      } catch (err) {
        console.error("[OfflineProvider] Initialization failed:", err);
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to initialize database",
          );
        }
      }
    }

    init();

    return () => {
      mounted = false;
      // Note: We don't close the database here as it may be used elsewhere
      // Database cleanup happens on app termination
    };
  }, []);

  // Refresh pending count (defined first since performSync uses it)
  const refreshPendingCount = useCallback(async () => {
    if (!dbRef.current) return;

    try {
      const stats = await getQueueStats(dbRef.current);
      setPendingCount(stats.pending + stats.failed);
    } catch (err) {
      console.error("[OfflineProvider] Failed to refresh pending count:", err);
    }
  }, []);

  // Perform sync operation (defined before useEffects that depend on it)
  const performSync = useCallback(
    async (options: SyncOptions): Promise<SyncResult> => {
      if (!syncManagerRef.current) {
        return {
          success: false,
          direction: options.direction ?? "both",
          pulled: 0,
          pushed: 0,
          failed: 0,
          errors: ["SyncManager not initialized"],
          duration: 0,
        };
      }

      if (!effectiveIsOnline) {
        return {
          success: false,
          direction: options.direction ?? "both",
          pulled: 0,
          pushed: 0,
          failed: 0,
          errors: ["Device is offline"],
          duration: 0,
        };
      }

      setSyncStatus("syncing");
      setError(null);

      try {
        const result = await syncManagerRef.current.sync(options);

        setLastSyncResult(result);
        lastSyncTimeRef.current = Date.now();
        setLastSyncAt(new Date());

        if (result.success) {
          setSyncStatus("idle");
        } else {
          setSyncStatus("error");
          setError(result.errors.join(", ") || "Sync failed");
        }

        // Refresh pending count after sync
        await refreshPendingCount();

        return result;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown sync error";
        setSyncStatus("error");
        setError(errorMsg);

        return {
          success: false,
          direction: options.direction ?? "both",
          pulled: 0,
          pushed: 0,
          failed: 0,
          errors: [errorMsg],
          duration: 0,
        };
      }
    },
    [effectiveIsOnline, refreshPendingCount],
  );

  // Manual sync trigger
  const sync = useCallback(
    async (options?: SyncOptions): Promise<SyncResult> => {
      const syncOptions: SyncOptions = {
        festivalId,
        userId,
        direction: "both",
        ...options,
      };
      return performSync(syncOptions);
    },
    [festivalId, userId, performSync],
  );

  // Abort sync
  const abortSync = useCallback(() => {
    if (syncManagerRef.current) {
      syncManagerRef.current.abort();
      setSyncStatus("idle");
    }
  }, []);

  // Get database instance
  const getDb = useCallback((): SQLite.SQLiteDatabase => {
    if (!dbRef.current) {
      throw new Error("Database not initialized. Wait for isReady to be true.");
    }
    return dbRef.current;
  }, []);

  // Get SyncManager instance
  const getSyncManager = useCallback((): SyncManager => {
    if (!syncManagerRef.current) {
      throw new Error(
        "SyncManager not initialized. Wait for isReady to be true.",
      );
    }
    return syncManagerRef.current;
  }, []);

  // Subscribe to network status changes
  useEffect(() => {
    if (Platform.OS === "web") {
      // On web, use navigator.onLine - schedule to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => setIsOnline(navigator.onLine), 0);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    // On native, use NetInfo
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === null ? true : state.isConnected;
      setIsOnline(online);

      // Update sync status when going offline
      if (!online) {
        setSyncStatus("offline");
      } else if (syncStatus === "offline") {
        setSyncStatus("idle");
      }
    });

    return () => unsubscribe();
  }, [syncStatus]);

  // Sync when coming back online
  useEffect(() => {
    if (!isReady || !effectiveIsOnline || disableAutoSync) return;
    if (syncStatus === "syncing") return;

    // Check if we should sync (respect minimum interval)
    const now = Date.now();
    if (now - lastSyncTimeRef.current < MIN_SYNC_INTERVAL) return;

    // Delay slightly to let network stabilize
    const timeoutId = setTimeout(() => {
      if (festivalId) {
        performSync({ festivalId, userId, direction: "both" });
      }
    }, ONLINE_SYNC_DELAY);

    return () => clearTimeout(timeoutId);
  }, [
    effectiveIsOnline,
    isReady,
    festivalId,
    userId,
    disableAutoSync,
    performSync,
  ]);

  // Sync on app foreground
  useEffect(() => {
    if (Platform.OS === "web" || disableAutoSync) return;

    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        // App came to foreground
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          // Check if we should sync
          const now = Date.now();
          if (
            isReady &&
            effectiveIsOnline &&
            festivalId &&
            now - lastSyncTimeRef.current >= MIN_SYNC_INTERVAL
          ) {
            performSync({ festivalId, userId, direction: "pull" });
          }
        }
        appStateRef.current = nextAppState;
      },
    );

    return () => subscription.remove();
  }, [
    isReady,
    effectiveIsOnline,
    festivalId,
    userId,
    disableAutoSync,
    performSync,
  ]);

  // Context value
  const contextValue: OfflineContextType = {
    isReady,
    isOnline: effectiveIsOnline,
    syncStatus,
    lastSyncResult,
    pendingCount,
    lastSyncAt,
    error,
    sync,
    abortSync,
    getDb,
    getSyncManager,
    refreshPendingCount,
    isSimulatingOffline: simulateOffline,
    setSimulateOffline,
  };

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
    </OfflineContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access offline data capabilities.
 * Must be used within an OfflineDataProvider.
 */
export function useOffline(): OfflineContextType {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error("useOffline must be used within an OfflineDataProvider");
  }
  return context;
}

/**
 * Hook to check if offline mode is ready.
 * Safe to use outside of OfflineDataProvider (returns false).
 */
export function useOfflineReady(): boolean {
  const context = useContext(OfflineContext);
  return context?.isReady ?? false;
}

/**
 * Hook to check if device is online.
 * Safe to use outside of OfflineDataProvider (returns true).
 */
export function useIsOnline(): boolean {
  const context = useContext(OfflineContext);
  return context?.isOnline ?? true;
}

/**
 * Hook to get pending sync count.
 * Safe to use outside of OfflineDataProvider (returns 0).
 */
export function usePendingCount(): number {
  const context = useContext(OfflineContext);
  return context?.pendingCount ?? 0;
}
