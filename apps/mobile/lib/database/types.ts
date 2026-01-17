/**
 * Database Types
 *
 * Re-exports and utility types for the offline database.
 * Provides convenience types for working with local data.
 */

import type { OfflineFields as SchemaOfflineFields } from "./schema";

// Re-export all schema types
export type {
  AchievementCategory,
  AchievementRarity,
  // Enums
  DrinkType,
  FestivalStatus,
  FestivalType,
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
  // Base types
  OfflineFields,
  PhotoVisibility,
  // Sync types
  SyncMetadata,
  SyncOperationType,
  SyncQueueItem,
  SyncStatus,
} from "./schema";

// Type alias for use in this file's generics
type OfflineFields = SchemaOfflineFields;

// Re-export constants
export {
  DATABASE_NAME,
  MUTABLE_TABLES,
  REFERENCE_TABLES,
  SCHEMA_VERSION,
  SYNCABLE_TABLES,
} from "./schema";

/**
 * Sync state for the offline provider
 */
export type SyncState = "idle" | "syncing" | "error" | "offline";

/**
 * Database status for monitoring
 */
export interface DatabaseStatus {
  isInitialized: boolean;
  isOnline: boolean;
  syncState: SyncState;
  pendingOperations: number;
  dirtyRecords: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

/**
 * Result type for mutations that may queue for sync
 */
export interface MutationResult<T> {
  data: T;
  queued: boolean;
  queueId?: string;
}

/**
 * Options for database queries
 */
export interface QueryOptions {
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Generic type for upsert operations
 */
export type UpsertData<T> = Omit<T, keyof OfflineFields> & {
  id: string;
};

/**
 * Type for creating new records (auto-generates ID if not provided)
 */
export type InsertData<T> = Omit<T, keyof OfflineFields | "id"> & {
  id?: string;
};

/**
 * Type for updating existing records
 */
export type UpdateData<T> = Partial<Omit<T, keyof OfflineFields | "id">> & {
  id: string;
};

/**
 * Attendance with consumption totals (computed view)
 */
export interface AttendanceWithTotals {
  id: string;
  user_id: string;
  festival_id: string;
  date: string;
  beer_count: number;
  drink_count: number;
  total_spent_cents: number;
  total_base_cents: number;
  total_tip_cents: number;
  avg_price_cents: number;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Group member with profile info
 */
export interface GroupMemberWithProfile {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

/**
 * User achievement with achievement details
 */
export interface UserAchievementWithDetails {
  id: string;
  user_id: string;
  achievement_id: string;
  festival_id: string;
  unlocked_at: string;
  progress: string | null;
  // Achievement details
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  points: number;
}

/**
 * Beer picture with local URI support
 */
export interface BeerPictureDisplay {
  id: string;
  attendance_id: string;
  user_id: string;
  picture_url: string | null;
  visibility: "public" | "private";
  created_at: string;
  // Local display info
  displayUri: string; // Either picture_url or _local_uri
  isPending: boolean;
}

/**
 * Sync operation with parsed payload
 */
export interface ParsedSyncOperation<T = unknown> {
  id: string;
  operation: "INSERT" | "UPDATE" | "DELETE" | "UPLOAD_FILE";
  table_name: string;
  record_id: string;
  payload: T;
  idempotency_key: string | null;
  depends_on: string | null;
  status: "pending" | "processing" | "failed" | "completed";
  retry_count: number;
  last_error: string | null;
  created_at: string;
}

/**
 * Helper to convert offline fields for API submission
 */
export function stripOfflineFields<T extends OfflineFields>(
  record: T,
): Omit<T, keyof OfflineFields> {
  const { _synced_at, _deleted, _dirty, ...rest } = record;
  return rest as Omit<T, keyof OfflineFields>;
}

/**
 * Helper to check if a record needs sync
 */
export function needsSync<T extends OfflineFields>(record: T): boolean {
  return record._dirty === 1 && record._deleted === 0;
}

/**
 * Helper to check if a record is deleted
 */
export function isDeleted<T extends OfflineFields>(record: T): boolean {
  return record._deleted === 1;
}

/**
 * Helper to check if a record was synced
 */
export function isSynced<T extends OfflineFields>(record: T): boolean {
  return record._dirty === 0 && record._synced_at !== null;
}
