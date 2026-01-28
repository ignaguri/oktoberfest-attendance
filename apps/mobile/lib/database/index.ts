/**
 * Database Module
 *
 * Provides offline-first SQLite storage for the ProstCounter mobile app.
 *
 * Usage:
 * 1. Wrap your app with <DatabaseProvider>
 * 2. Use hooks like useDatabase(), useDatabaseStatus() to access the database
 * 3. Use utility functions from sync-queue.ts to manage sync operations
 *
 * @example
 * ```tsx
 * import { DatabaseProvider, useDatabase, useSyncIndicator } from '@/lib/database';
 *
 * // In your app layout
 * <DatabaseProvider>
 *   <YourApp />
 * </DatabaseProvider>
 *
 * // In a component
 * function MyComponent() {
 *   const { db, isReady } = useDatabase();
 *   const { isOffline, hasPendingChanges } = useSyncIndicator();
 *
 *   if (!isReady) return <Loading />;
 *   // ...
 * }
 * ```
 */

// Provider and hooks
export {
  DatabaseProvider,
  useDatabase,
  useDatabaseInstance,
  useDatabaseStatus,
  useIsDatabaseReady,
  useSyncIndicator,
} from "./provider";

// Database operations
export {
  checkDatabaseIntegrity,
  closeDatabase,
  getDatabase,
  getDatabaseStats,
  getSchemaVersion,
  initializeDatabase,
  initializeSchema,
  needsMigration,
  openDatabase,
  resetDatabase,
  setSchemaVersion,
} from "./init";

// Migration utilities
export {
  addColumnIfNotExists,
  backupTable,
  createIndexIfNotExists,
  dropBackup,
  dropIndexIfExists,
  getMigrationStatus,
  renameTable,
  restoreFromBackup,
  runMigrations,
} from "./migrations";

// Sync queue operations
export {
  cleanupCompletedOperations,
  clearSyncMetadata,
  deleteOperation,
  // Queue operations
  enqueueOperation,
  // Idempotency
  generateConsumptionIdempotencyKey,
  generateUUID,
  getAllPendingOperations,
  getAllSyncMetadata,
  getDirtyRecordCount,
  getDirtyRecords,
  getFailedOperations,
  getPendingOperations,
  getQueueStats,
  // Sync metadata
  getSyncMetadata,
  idempotencyKeyExists,
  markOperationCompleted,
  markOperationFailed,
  markOperationProcessing,
  markRecordClean,
  // Dirty tracking
  markRecordDirty,
  purgeDeletedRecords,
  retryOperation,
  // Soft delete
  softDeleteRecord,
  updateLastSyncAt,
  updateOperationStatus,
  updatePullCursor,
} from "./sync-queue";

// Types
export type {
  AchievementCategory,
  AchievementRarity,
  AttendanceWithTotals,
  BeerPictureDisplay,
  DatabaseStatus,
  // Enums
  DrinkType,
  FestivalStatus,
  FestivalType,
  GroupMemberWithProfile,
  InsertData,
  LocalAchievement,
  LocalAttendance,
  LocalBeerPicture,
  LocalConsumption,
  LocalDrinkTypePrice,
  // Entity types
  LocalFestival,
  LocalFestivalTent,
  LocalGroup,
  LocalGroupMember,
  LocalProfile,
  LocalTent,
  LocalTentVisit,
  LocalUserAchievement,
  LocalWinningCriteria,
  MutationResult,
  // Base types
  OfflineFields,
  ParsedSyncOperation,
  PhotoVisibility,
  QueryOptions,
  // Sync types
  SyncMetadata,
  SyncOperationType,
  SyncQueueItem,
  // Utility types
  SyncState,
  SyncStatus,
  UpdateData,
  UpsertData,
  UserAchievementWithDetails,
} from "./types";

// Type helpers
export { isDeleted, isSynced, needsSync, stripOfflineFields } from "./types";

// Background sync
export {
  BACKGROUND_SYNC_TASK,
  BackgroundFetchResult,
  getBackgroundFetchStatus,
  isBackgroundSyncEnabled,
  registerBackgroundSync,
  setBackgroundSyncContext,
  unregisterBackgroundSync,
} from "./background-sync";

// Constants
export {
  CREATE_INDEXES_SQL,
  CREATE_TABLES_SQL,
  DATABASE_NAME,
  MUTABLE_TABLES,
  REFERENCE_TABLES,
  SCHEMA_VERSION,
  SYNCABLE_TABLES,
  TABLE_CREATION_ORDER,
} from "./schema";
