/**
 * Database Provider
 *
 * Provides database access throughout the app via React Context.
 * Handles:
 * - Database initialization on mount
 * - Database cleanup on unmount
 * - Exposing database status and operations
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
  useMemo,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

import { logger } from "@/lib/logger";

import { closeDatabase, initializeDatabase, resetDatabase } from "./init";
import { getMigrationStatus, runMigrations } from "./migrations";
import { MUTABLE_TABLES } from "./schema";
import {
  cleanupCompletedOperations,
  getDirtyRecordCount,
  getQueueStats,
} from "./sync-queue";
import type { DatabaseStatus, SyncState } from "./types";

// =============================================================================
// Context Types
// =============================================================================

interface DatabaseContextValue {
  /** Database instance - null until initialized */
  db: SQLite.SQLiteDatabase | null;
  /** Current database status */
  status: DatabaseStatus;
  /** Force refresh database stats */
  refreshStatus: () => Promise<void>;
  /** Reset the database (deletes all local data) */
  reset: () => Promise<void>;
  /** Whether the database is ready for use */
  isReady: boolean;
}

// =============================================================================
// Context
// =============================================================================

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

// =============================================================================
// Provider Component
// =============================================================================

interface DatabaseProviderProps {
  children: ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [pendingOperations, setPendingOperations] = useState(0);
  const [dirtyRecords, setDirtyRecords] = useState(0);
  const [lastSyncAt, _setLastSyncAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Database Initialization
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        logger.debug("[DatabaseProvider] Initializing...");

        // Initialize database
        const database = await initializeDatabase();

        // Run migrations if needed
        const migrationStatus = await getMigrationStatus(database);
        if (migrationStatus.pendingMigrations > 0) {
          await runMigrations(database);
        }

        // Clean up old completed operations
        await cleanupCompletedOperations(database, 48);

        if (mounted) {
          setDb(database);
          setIsInitialized(true);
          logger.debug("[DatabaseProvider] Initialized successfully");
        }
      } catch (error) {
        logger.error("[DatabaseProvider] Initialization failed:", error);
        if (mounted) {
          setLastError(
            error instanceof Error
              ? error.message
              : "Database initialization failed",
          );
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Network State Monitoring
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected ?? true;
      setIsOnline(connected);

      if (!connected) {
        setSyncState("offline");
      } else if (syncState === "offline") {
        setSyncState("idle");
      }
    });

    return () => unsubscribe();
  }, [syncState]);

  // ---------------------------------------------------------------------------
  // App State Monitoring (background/foreground)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === "background") {
        // Close database when app goes to background
        // This helps prevent database lock issues
        logger.debug("[DatabaseProvider] App backgrounded, closing database");
        await closeDatabase();
        setDb(null);
        setIsInitialized(false);
      } else if (nextState === "active" && !isInitialized) {
        // Reinitialize when app comes back to foreground
        logger.debug("[DatabaseProvider] App foregrounded, reinitializing");
        try {
          const database = await initializeDatabase();
          setDb(database);
          setIsInitialized(true);
        } catch (error) {
          logger.error("[DatabaseProvider] Reinitialization failed:", error);
          setLastError(
            error instanceof Error
              ? error.message
              : "Database reinitialization failed",
          );
        }
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [isInitialized]);

  // ---------------------------------------------------------------------------
  // Status Refresh
  // ---------------------------------------------------------------------------

  const refreshStatus = useCallback(async () => {
    if (!db) return;

    try {
      // Get queue stats
      const queueStats = await getQueueStats(db);
      setPendingOperations(queueStats.pending + queueStats.processing);

      // Get dirty record count
      const dirty = await getDirtyRecordCount(db, MUTABLE_TABLES);
      setDirtyRecords(dirty);

      // Clear error if we successfully refreshed
      setLastError(null);
    } catch (error) {
      logger.error("[DatabaseProvider] Status refresh failed:", error);
      setLastError(
        error instanceof Error ? error.message : "Status refresh failed",
      );
    }
  }, [db]);

  // Refresh status periodically and on initialization
  useEffect(() => {
    if (!isInitialized || !db) return;

    // Initial refresh - schedule to avoid synchronous setState in effect
    const timeoutId = setTimeout(refreshStatus, 0);

    // Refresh every 30 seconds
    const interval = setInterval(refreshStatus, 30000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [isInitialized, db, refreshStatus]);

  // ---------------------------------------------------------------------------
  // Reset Function
  // ---------------------------------------------------------------------------

  const reset = useCallback(async () => {
    try {
      setIsInitialized(false);
      setDb(null);
      await resetDatabase();
      const database = await initializeDatabase();
      setDb(database);
      setIsInitialized(true);
      setPendingOperations(0);
      setDirtyRecords(0);
      setLastError(null);
      logger.debug("[DatabaseProvider] Reset complete");
    } catch (error) {
      logger.error("[DatabaseProvider] Reset failed:", error);
      setLastError(
        error instanceof Error ? error.message : "Database reset failed",
      );
      throw error;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Context Value
  // ---------------------------------------------------------------------------

  const status: DatabaseStatus = useMemo(
    () => ({
      isInitialized,
      isOnline,
      syncState,
      pendingOperations,
      dirtyRecords,
      lastSyncAt,
      lastError,
    }),
    [
      isInitialized,
      isOnline,
      syncState,
      pendingOperations,
      dirtyRecords,
      lastSyncAt,
      lastError,
    ],
  );

  const value: DatabaseContextValue = useMemo(
    () => ({
      db,
      status,
      refreshStatus,
      reset,
      isReady: isInitialized && db !== null,
    }),
    [db, status, refreshStatus, reset, isInitialized],
  );

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access the database context.
 * Throws if used outside of DatabaseProvider.
 */
export function useDatabase(): DatabaseContextValue {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
}

/**
 * Hook to access the database instance.
 * Returns null if not initialized.
 */
export function useDatabaseInstance(): SQLite.SQLiteDatabase | null {
  const { db } = useDatabase();
  return db;
}

/**
 * Hook to check if database is ready.
 */
export function useIsDatabaseReady(): boolean {
  const { isReady } = useDatabase();
  return isReady;
}

/**
 * Hook to get database status.
 */
export function useDatabaseStatus(): DatabaseStatus {
  const { status } = useDatabase();
  return status;
}

/**
 * Hook for getting sync state indicators.
 */
export function useSyncIndicator(): {
  isOffline: boolean;
  isSyncing: boolean;
  hasPendingChanges: boolean;
  hasError: boolean;
  errorMessage: string | null;
} {
  const { status } = useDatabase();

  return useMemo(
    () => ({
      isOffline: !status.isOnline,
      isSyncing: status.syncState === "syncing",
      hasPendingChanges:
        status.pendingOperations > 0 || status.dirtyRecords > 0,
      hasError: status.syncState === "error" || status.lastError !== null,
      errorMessage: status.lastError,
    }),
    [status],
  );
}
