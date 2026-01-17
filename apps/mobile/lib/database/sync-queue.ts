/**
 * Sync Queue Utilities
 *
 * Provides helper functions for working with the sync queue:
 * - Adding operations to the queue
 * - Processing pending operations
 * - Managing sync metadata
 * - Handling operation dependencies
 */

import type {
  SyncMetadata,
  SyncQueueItem,
  SyncOperationType,
  SyncStatus,
} from "./schema";
import type * as SQLite from "expo-sqlite";

// =============================================================================
// UUID Generation
// =============================================================================

/**
 * Generates a UUID v4 for sync queue IDs.
 * Uses crypto API when available, falls back to Math.random.
 */
export function generateUUID(): string {
  // Use crypto API if available (React Native supports this)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// =============================================================================
// Sync Metadata Operations
// =============================================================================

/**
 * Gets sync metadata for a specific table.
 */
export async function getSyncMetadata(
  db: SQLite.SQLiteDatabase,
  tableName: string,
): Promise<SyncMetadata | null> {
  const result = await db.getFirstAsync<SyncMetadata>(
    `SELECT * FROM _sync_metadata WHERE table_name = ?`,
    [tableName],
  );
  return result ?? null;
}

/**
 * Updates the last sync timestamp for a table.
 */
export async function updateLastSyncAt(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  timestamp: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE _sync_metadata SET last_sync_at = ? WHERE table_name = ?`,
    [timestamp, tableName],
  );
}

/**
 * Updates the pull cursor for delta sync.
 */
export async function updatePullCursor(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  cursor: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE _sync_metadata SET last_pull_cursor = ? WHERE table_name = ?`,
    [cursor, tableName],
  );
}

/**
 * Gets all sync metadata records.
 */
export async function getAllSyncMetadata(
  db: SQLite.SQLiteDatabase,
): Promise<SyncMetadata[]> {
  return db.getAllAsync<SyncMetadata>(`SELECT * FROM _sync_metadata`);
}

/**
 * Clears sync metadata for a table (forces full re-sync).
 */
export async function clearSyncMetadata(
  db: SQLite.SQLiteDatabase,
  tableName: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE _sync_metadata SET last_sync_at = NULL, last_pull_cursor = NULL WHERE table_name = ?`,
    [tableName],
  );
}

// =============================================================================
// Sync Queue Operations
// =============================================================================

/**
 * Adds an operation to the sync queue.
 */
export async function enqueueOperation(
  db: SQLite.SQLiteDatabase,
  operation: SyncOperationType,
  tableName: string,
  recordId: string,
  payload: Record<string, unknown>,
  options?: {
    idempotencyKey?: string;
    dependsOn?: string;
  },
): Promise<string> {
  const id = generateUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO _sync_queue (id, operation, table_name, record_id, payload, idempotency_key, depends_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      operation,
      tableName,
      recordId,
      JSON.stringify(payload),
      options?.idempotencyKey ?? null,
      options?.dependsOn ?? null,
      now,
    ],
  );

  console.log(`[SyncQueue] Enqueued ${operation} for ${tableName}/${recordId}`);
  return id;
}

/**
 * Gets pending operations ready to process.
 * Returns operations that:
 * - Have status 'pending'
 * - Have no dependencies OR dependencies are completed
 */
export async function getPendingOperations(
  db: SQLite.SQLiteDatabase,
  limit = 50,
): Promise<SyncQueueItem[]> {
  return db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM _sync_queue
     WHERE status = 'pending'
       AND (depends_on IS NULL
         OR depends_on IN (SELECT id FROM _sync_queue WHERE status = 'completed'))
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit],
  );
}

/**
 * Gets all pending operations (including those with unmet dependencies).
 */
export async function getAllPendingOperations(
  db: SQLite.SQLiteDatabase,
): Promise<SyncQueueItem[]> {
  return db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM _sync_queue WHERE status = 'pending' ORDER BY created_at ASC`,
  );
}

/**
 * Gets failed operations for retry or inspection.
 */
export async function getFailedOperations(
  db: SQLite.SQLiteDatabase,
  maxRetries = 3,
): Promise<SyncQueueItem[]> {
  return db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM _sync_queue WHERE status = 'failed' AND retry_count < ? ORDER BY created_at ASC`,
    [maxRetries],
  );
}

/**
 * Updates the status of an operation.
 */
export async function updateOperationStatus(
  db: SQLite.SQLiteDatabase,
  operationId: string,
  status: SyncStatus,
  error?: string,
): Promise<void> {
  if (error) {
    await db.runAsync(
      `UPDATE _sync_queue SET status = ?, last_error = ?, retry_count = retry_count + 1 WHERE id = ?`,
      [status, error, operationId],
    );
  } else {
    await db.runAsync(
      `UPDATE _sync_queue SET status = ?, last_error = NULL WHERE id = ?`,
      [status, operationId],
    );
  }
}

/**
 * Marks an operation as processing.
 */
export async function markOperationProcessing(
  db: SQLite.SQLiteDatabase,
  operationId: string,
): Promise<void> {
  await updateOperationStatus(db, operationId, "processing");
}

/**
 * Marks an operation as completed.
 */
export async function markOperationCompleted(
  db: SQLite.SQLiteDatabase,
  operationId: string,
): Promise<void> {
  await updateOperationStatus(db, operationId, "completed");
}

/**
 * Marks an operation as failed with error message.
 */
export async function markOperationFailed(
  db: SQLite.SQLiteDatabase,
  operationId: string,
  error: string,
): Promise<void> {
  await updateOperationStatus(db, operationId, "failed", error);
}

/**
 * Resets a failed operation to pending for retry.
 */
export async function retryOperation(
  db: SQLite.SQLiteDatabase,
  operationId: string,
): Promise<void> {
  await db.runAsync(`UPDATE _sync_queue SET status = 'pending' WHERE id = ?`, [
    operationId,
  ]);
}

/**
 * Deletes completed operations older than a threshold.
 * Keeps the queue clean.
 */
export async function cleanupCompletedOperations(
  db: SQLite.SQLiteDatabase,
  olderThanHours = 24,
): Promise<number> {
  const threshold = new Date();
  threshold.setHours(threshold.getHours() - olderThanHours);

  const result = await db.runAsync(
    `DELETE FROM _sync_queue WHERE status = 'completed' AND created_at < ?`,
    [threshold.toISOString()],
  );

  if (result.changes > 0) {
    console.log(
      `[SyncQueue] Cleaned up ${result.changes} completed operations`,
    );
  }
  return result.changes;
}

/**
 * Deletes permanently failed operations.
 * Call this after user acknowledges or resolves the issue.
 */
export async function deleteOperation(
  db: SQLite.SQLiteDatabase,
  operationId: string,
): Promise<void> {
  await db.runAsync(`DELETE FROM _sync_queue WHERE id = ?`, [operationId]);
}

/**
 * Gets queue statistics.
 */
export async function getQueueStats(db: SQLite.SQLiteDatabase): Promise<{
  pending: number;
  processing: number;
  failed: number;
  completed: number;
  total: number;
}> {
  const result = await db.getFirstAsync<{
    pending: number;
    processing: number;
    failed: number;
    completed: number;
    total: number;
  }>(`
    SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      COUNT(*) as total
    FROM _sync_queue
  `);

  return {
    pending: result?.pending ?? 0,
    processing: result?.processing ?? 0,
    failed: result?.failed ?? 0,
    completed: result?.completed ?? 0,
    total: result?.total ?? 0,
  };
}

// =============================================================================
// Dirty Record Tracking
// =============================================================================

/**
 * Marks a record as dirty (needs sync).
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
 * Marks a record as clean (synced).
 */
export async function markRecordClean(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  recordId: string,
  syncedAt: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE ${tableName} SET _dirty = 0, _synced_at = ? WHERE id = ?`,
    [syncedAt, recordId],
  );
}

/**
 * Gets all dirty records from a table.
 */
export async function getDirtyRecords<T>(
  db: SQLite.SQLiteDatabase,
  tableName: string,
): Promise<T[]> {
  return db.getAllAsync<T>(
    `SELECT * FROM ${tableName} WHERE _dirty = 1 AND _deleted = 0`,
  );
}

/**
 * Gets count of dirty records across all tables.
 */
export async function getDirtyRecordCount(
  db: SQLite.SQLiteDatabase,
  tables: string[],
): Promise<number> {
  let total = 0;
  for (const tableName of tables) {
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${tableName} WHERE _dirty = 1`,
    );
    total += result?.count ?? 0;
  }
  return total;
}

// =============================================================================
// Soft Delete Operations
// =============================================================================

/**
 * Soft deletes a record (marks as deleted).
 */
export async function softDeleteRecord(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  recordId: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE ${tableName} SET _deleted = 1, _dirty = 1 WHERE id = ?`,
    [recordId],
  );
}

/**
 * Hard deletes records that are soft deleted and synced.
 * Call this during cleanup to free up space.
 */
export async function purgeDeletedRecords(
  db: SQLite.SQLiteDatabase,
  tableName: string,
): Promise<number> {
  const result = await db.runAsync(
    `DELETE FROM ${tableName} WHERE _deleted = 1 AND _dirty = 0`,
  );
  return result.changes;
}

// =============================================================================
// Idempotency Key Helpers
// =============================================================================

/**
 * Generates an idempotency key for a consumption record.
 */
export function generateConsumptionIdempotencyKey(
  userId: string,
  festivalId: string,
  date: string,
  drinkType: string,
  timestamp: number,
): string {
  return `${userId}-${festivalId}-${date}-${drinkType}-${timestamp}`;
}

/**
 * Checks if an idempotency key already exists in the queue.
 */
export async function idempotencyKeyExists(
  db: SQLite.SQLiteDatabase,
  key: string,
): Promise<boolean> {
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM _sync_queue WHERE idempotency_key = ? AND status != 'failed'`,
    [key],
  );
  return (result?.count ?? 0) > 0;
}
