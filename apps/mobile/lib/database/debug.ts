/**
 * Database Debugging Tools
 *
 * Developer utilities for debugging offline-first functionality:
 * - View pending sync operations
 * - Inspect dirty records
 * - Force sync operations
 * - Export/import database
 * - Clear database for testing
 */

import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  documentDirectory,
  getInfoAsync,
} from "expo-file-system/legacy";
import type * as SQLite from "expo-sqlite";

import { logger } from "@/lib/logger";

import { closeDatabase, initializeDatabase } from "./init";
import { cleanupOrphanedPhotos, getPhotoQueueStats } from "./photo-queue";
import { DATABASE_NAME, MUTABLE_TABLES, SYNCABLE_TABLES } from "./schema";
import { cleanupCompletedOperations, getQueueStats } from "./sync-queue";

// =============================================================================
// Types
// =============================================================================

export interface TableStats {
  name: string;
  totalRows: number;
  dirtyRows: number;
  deletedRows: number;
  pendingSync: number;
}

export interface DatabaseStats {
  tables: TableStats[];
  syncQueue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  photos: {
    total: number;
    pending: number;
    uploaded: number;
    pendingSizeBytes: number;
  };
  databaseSizeBytes: number;
}

export interface DirtyRecord {
  table: string;
  id: string;
  data: Record<string, unknown>;
  operation: "INSERT" | "UPDATE" | "DELETE";
}

export interface SyncQueueEntry {
  id: string;
  operation: string;
  table_name: string;
  record_id: string;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: string;
}

// =============================================================================
// Database Statistics
// =============================================================================

/**
 * Get comprehensive database statistics
 */
export async function getDatabaseStats(
  db: SQLite.SQLiteDatabase,
): Promise<DatabaseStats> {
  const tables: TableStats[] = [];

  // Get stats for each syncable table
  for (const tableName of SYNCABLE_TABLES) {
    try {
      const totalResult = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${tableName}`,
      );

      const dirtyResult = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE _dirty = 1`,
      );

      const deletedResult = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE _deleted = 1`,
      );

      const pendingResult = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM _sync_queue
         WHERE table_name = ? AND status IN ('pending', 'processing')`,
        [tableName],
      );

      tables.push({
        name: tableName,
        totalRows: totalResult?.count || 0,
        dirtyRows: dirtyResult?.count || 0,
        deletedRows: deletedResult?.count || 0,
        pendingSync: pendingResult?.count || 0,
      });
    } catch (error) {
      // Table might not exist yet
      tables.push({
        name: tableName,
        totalRows: 0,
        dirtyRows: 0,
        deletedRows: 0,
        pendingSync: 0,
      });
    }
  }

  // Get sync queue stats
  const syncQueue = await getQueueStats(db);

  // Get photo stats
  const photos = await getPhotoQueueStats(db);

  // Get database file size
  let databaseSizeBytes = 0;
  try {
    const dbPath = `${documentDirectory}SQLite/${DATABASE_NAME}`;
    const fileInfo = await getInfoAsync(dbPath);
    if (fileInfo.exists && "size" in fileInfo) {
      databaseSizeBytes = fileInfo.size as number;
    }
  } catch {
    // Ignore errors
  }

  return {
    tables,
    syncQueue,
    photos,
    databaseSizeBytes,
  };
}

// =============================================================================
// Dirty Records Inspection
// =============================================================================

/**
 * Get all dirty records across all mutable tables
 */
export async function getDirtyRecords(
  db: SQLite.SQLiteDatabase,
): Promise<DirtyRecord[]> {
  const dirtyRecords: DirtyRecord[] = [];

  for (const tableName of MUTABLE_TABLES) {
    try {
      const records = await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM ${tableName} WHERE _dirty = 1`,
      );

      for (const record of records) {
        // Determine operation type
        let operation: "INSERT" | "UPDATE" | "DELETE" = "UPDATE";
        if (record._deleted === 1) {
          operation = "DELETE";
        } else if (record._synced_at === null) {
          operation = "INSERT";
        }

        dirtyRecords.push({
          table: tableName,
          id: record.id as string,
          data: record,
          operation,
        });
      }
    } catch {
      // Table might not exist
    }
  }

  return dirtyRecords;
}

/**
 * Get dirty records for a specific table
 */
export async function getDirtyRecordsForTable(
  db: SQLite.SQLiteDatabase,
  tableName: string,
): Promise<Record<string, unknown>[]> {
  return db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM ${tableName} WHERE _dirty = 1`,
  );
}

// =============================================================================
// Sync Queue Inspection
// =============================================================================

/**
 * Get all pending sync operations with details
 */
export async function getPendingSyncOperations(
  db: SQLite.SQLiteDatabase,
): Promise<SyncQueueEntry[]> {
  return db.getAllAsync<SyncQueueEntry>(
    `SELECT id, operation, table_name, record_id, status, retry_count, last_error, created_at
     FROM _sync_queue
     WHERE status IN ('pending', 'processing', 'failed')
     ORDER BY created_at ASC`,
  );
}

/**
 * Get failed sync operations
 */
export async function getFailedOperations(
  db: SQLite.SQLiteDatabase,
): Promise<SyncQueueEntry[]> {
  return db.getAllAsync<SyncQueueEntry>(
    `SELECT id, operation, table_name, record_id, status, retry_count, last_error, created_at
     FROM _sync_queue
     WHERE status = 'failed'
     ORDER BY created_at DESC`,
  );
}

/**
 * Retry a specific failed operation
 */
export async function retryOperation(
  db: SQLite.SQLiteDatabase,
  operationId: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE _sync_queue SET status = 'pending', retry_count = 0 WHERE id = ?`,
    [operationId],
  );
}

/**
 * Retry all failed operations
 */
export async function retryAllFailedOperations(
  db: SQLite.SQLiteDatabase,
): Promise<number> {
  const result = await db.runAsync(
    `UPDATE _sync_queue SET status = 'pending', retry_count = 0 WHERE status = 'failed'`,
  );
  return result.changes;
}

/**
 * Delete all failed operations (permanently remove from queue)
 */
export async function deleteFailedOperations(
  db: SQLite.SQLiteDatabase,
): Promise<number> {
  const result = await db.runAsync(
    `DELETE FROM _sync_queue WHERE status = 'failed'`,
  );
  return result.changes;
}

// =============================================================================
// Force Sync Operations
// =============================================================================

/**
 * Mark all records in a table as dirty (force re-sync)
 */
export async function markTableDirty(
  db: SQLite.SQLiteDatabase,
  tableName: string,
): Promise<number> {
  const result = await db.runAsync(
    `UPDATE ${tableName} SET _dirty = 1 WHERE _deleted = 0`,
  );
  return result.changes;
}

/**
 * Mark a specific record as dirty
 */
export async function markRecordDirty(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  recordId: string,
): Promise<void> {
  await db.runAsync(`UPDATE ${tableName} SET _dirty = 1 WHERE id = ?`, [
    recordId,
  ]);
}

/**
 * Clear sync metadata to force full re-sync
 */
export async function clearSyncMetadata(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  await db.runAsync(
    `UPDATE _sync_metadata SET last_sync_at = NULL, last_pull_cursor = NULL`,
  );
}

// =============================================================================
// Database Export/Import
// =============================================================================

/**
 * Export database to a file in cache directory
 * Returns the path to the exported file
 */
export async function exportDatabase(): Promise<string | null> {
  try {
    const dbPath = `${documentDirectory}SQLite/${DATABASE_NAME}`;
    const exportPath = `${cacheDirectory}${DATABASE_NAME}-export-${Date.now()}.db`;

    // Copy database to cache
    await copyAsync({
      from: dbPath,
      to: exportPath,
    });

    logger.debug("[Debug] Database exported to:", { exportPath });
    return exportPath;
  } catch (error) {
    logger.error("[Debug] Failed to export database:", error);
    return null;
  }
}

/**
 * Export database as JSON (for easier inspection)
 */
export async function exportDatabaseAsJson(
  db: SQLite.SQLiteDatabase,
): Promise<Record<string, unknown[]>> {
  const data: Record<string, unknown[]> = {};

  for (const tableName of SYNCABLE_TABLES) {
    try {
      const records = await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM ${tableName}`,
      );
      data[tableName] = records;
    } catch {
      data[tableName] = [];
    }
  }

  // Also export sync metadata
  try {
    data._sync_metadata = await db.getAllAsync("SELECT * FROM _sync_metadata");
    data._sync_queue = await db.getAllAsync("SELECT * FROM _sync_queue");
  } catch {
    data._sync_metadata = [];
    data._sync_queue = [];
  }

  return data;
}

// =============================================================================
// Database Cleanup
// =============================================================================

/**
 * Clear all data from the database (nuclear option)
 * Preserves schema but deletes all records
 */
export async function clearAllData(db: SQLite.SQLiteDatabase): Promise<void> {
  logger.debug("[Debug] Clearing all data from database...");

  // Clear in reverse dependency order
  const tablesInOrder = [...SYNCABLE_TABLES].reverse();

  for (const tableName of tablesInOrder) {
    try {
      await db.runAsync(`DELETE FROM ${tableName}`);
      logger.debug(`[Debug] Cleared table: ${tableName}`);
    } catch (error) {
      logger.warn(`[Debug] Failed to clear table ${tableName}:`, { error });
    }
  }

  // Clear metadata tables
  await db.runAsync("DELETE FROM _sync_queue");
  await db.runAsync("DELETE FROM _sync_metadata");

  logger.debug("[Debug] Database cleared");
}

/**
 * Clear completed sync operations (housekeeping)
 */
export async function clearCompletedSyncOperations(
  db: SQLite.SQLiteDatabase,
): Promise<number> {
  return cleanupCompletedOperations(db);
}

/**
 * Clear orphaned photos from filesystem
 */
export async function cleanupOrphanedPhotoFiles(
  db: SQLite.SQLiteDatabase,
): Promise<number> {
  return cleanupOrphanedPhotos(db);
}

/**
 * Reset database completely (delete and recreate)
 */
export async function resetDatabase(): Promise<void> {
  logger.debug("[Debug] Resetting database...");

  // Close existing connection
  await closeDatabase();

  // Delete database file
  try {
    const dbPath = `${documentDirectory}SQLite/${DATABASE_NAME}`;
    await deleteAsync(dbPath, { idempotent: true });
  } catch (error) {
    logger.warn("[Debug] Failed to delete database file:", { error });
  }

  // Reinitialize
  await initializeDatabase();

  logger.debug("[Debug] Database reset complete");
}

// =============================================================================
// Query Execution
// =============================================================================

/**
 * Execute a raw SQL query (for debugging)
 */
export async function executeRawQuery(
  db: SQLite.SQLiteDatabase,
  sql: string,
  params: unknown[] = [],
): Promise<unknown[]> {
  return db.getAllAsync(sql, params as SQLite.SQLiteBindParams);
}

/**
 * Execute a raw SQL statement (for debugging)
 */
export async function executeRawStatement(
  db: SQLite.SQLiteDatabase,
  sql: string,
  params: unknown[] = [],
): Promise<{ changes: number; lastInsertRowId: number }> {
  return db.runAsync(sql, params as SQLite.SQLiteBindParams);
}

// =============================================================================
// Performance Profiling
// =============================================================================

export interface QueryProfile {
  query: string;
  params: unknown[];
  durationMs: number;
  rowCount: number;
}

/**
 * Profile a query execution
 */
export async function profileQuery(
  db: SQLite.SQLiteDatabase,
  sql: string,
  params: unknown[] = [],
): Promise<QueryProfile> {
  const start = performance.now();
  const results = await db.getAllAsync(sql, params as SQLite.SQLiteBindParams);
  const end = performance.now();

  return {
    query: sql,
    params,
    durationMs: end - start,
    rowCount: results.length,
  };
}

/**
 * Profile common queries for performance analysis
 */
export async function profileCommonQueries(
  db: SQLite.SQLiteDatabase,
  festivalId: string,
  userId: string,
): Promise<QueryProfile[]> {
  const profiles: QueryProfile[] = [];

  const queries = [
    {
      name: "Get user attendances",
      sql: "SELECT * FROM attendances WHERE user_id = ? AND festival_id = ? AND _deleted = 0",
      params: [userId, festivalId],
    },
    {
      name: "Get pending sync count",
      sql: "SELECT COUNT(*) as count FROM _sync_queue WHERE status = 'pending'",
      params: [],
    },
    {
      name: "Get dirty records count",
      sql: "SELECT COUNT(*) as count FROM attendances WHERE _dirty = 1",
      params: [],
    },
    {
      name: "Get consumptions for attendance",
      sql: "SELECT * FROM consumptions WHERE attendance_id = ? AND _deleted = 0 ORDER BY recorded_at DESC",
      params: ["sample-attendance-id"],
    },
    {
      name: "Get user groups",
      sql: `SELECT g.* FROM groups g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = ? AND g._deleted = 0 AND gm._deleted = 0`,
      params: [userId],
    },
  ];

  for (const q of queries) {
    try {
      const profile = await profileQuery(db, q.sql, q.params);
      profiles.push(profile);
    } catch {
      profiles.push({
        query: q.sql,
        params: q.params,
        durationMs: -1,
        rowCount: 0,
      });
    }
  }

  return profiles;
}

// =============================================================================
// Debug Logger
// =============================================================================

/**
 * Log database state for debugging
 */
export async function logDatabaseState(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  logger.debug("=".repeat(60));
  logger.debug("[Debug] DATABASE STATE");
  logger.debug("=".repeat(60));

  const stats = await getDatabaseStats(db);

  logger.debug("\n📊 Table Statistics:");
  for (const table of stats.tables) {
    if (table.totalRows > 0 || table.dirtyRows > 0) {
      logger.debug(
        `  ${table.name}: ${table.totalRows} total, ${table.dirtyRows} dirty, ${table.deletedRows} deleted`,
      );
    }
  }

  logger.debug("\n🔄 Sync Queue:");
  logger.debug(`  Pending: ${stats.syncQueue.pending}`);
  logger.debug(`  Processing: ${stats.syncQueue.processing}`);
  logger.debug(`  Failed: ${stats.syncQueue.failed}`);
  logger.debug(`  Completed: ${stats.syncQueue.completed}`);

  logger.debug("\n📷 Photos:");
  logger.debug(`  Total: ${stats.photos.total}`);
  logger.debug(`  Pending upload: ${stats.photos.pending}`);
  logger.debug(
    `  Pending size: ${(stats.photos.pendingSizeBytes / 1024 / 1024).toFixed(2)} MB`,
  );

  logger.debug("\n💾 Database Size:");
  logger.debug(`  ${(stats.databaseSizeBytes / 1024 / 1024).toFixed(2)} MB`);

  logger.debug("=".repeat(60));
}

// =============================================================================
// Debug Helper Object
// =============================================================================

/**
 * Convenience object with all debug functions
 * Usage: DatabaseDebugger.logState(db)
 */
export const DatabaseDebugger = {
  getStats: getDatabaseStats,
  getDirtyRecords,
  getDirtyRecordsForTable,
  getPendingSync: getPendingSyncOperations,
  getFailedOps: getFailedOperations,
  retryOp: retryOperation,
  retryAllFailed: retryAllFailedOperations,
  deleteFailed: deleteFailedOperations,
  markTableDirty,
  markRecordDirty,
  clearSyncMetadata,
  exportDb: exportDatabase,
  exportAsJson: exportDatabaseAsJson,
  clearAll: clearAllData,
  clearCompletedSync: clearCompletedSyncOperations,
  cleanupOrphanedPhotos: cleanupOrphanedPhotoFiles,
  resetDb: resetDatabase,
  query: executeRawQuery,
  execute: executeRawStatement,
  profileQuery,
  profileCommon: profileCommonQueries,
  logState: logDatabaseState,
};

export default DatabaseDebugger;
