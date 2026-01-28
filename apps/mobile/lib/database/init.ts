/**
 * Database Initialization
 *
 * Opens and initializes the SQLite database with all required tables and indexes.
 * Handles schema migrations and provides database access utilities.
 */

import * as SQLite from "expo-sqlite";

import { logger } from "@/lib/logger";

import {
  CREATE_INDEXES_SQL,
  CREATE_TABLES_SQL,
  DATABASE_NAME,
  SCHEMA_VERSION,
  SYNCABLE_TABLES,
  TABLE_CREATION_ORDER,
} from "./schema";

// Singleton database instance
let dbInstance: SQLite.SQLiteDatabase | null = null;

// Initialization lock to prevent race conditions (React Strict Mode)
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens (or creates) the database and returns the instance.
 * Uses lazy initialization - only creates on first call.
 */
export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    // Open database with WAL mode for better performance
    dbInstance = await SQLite.openDatabaseAsync(DATABASE_NAME, {
      enableChangeListener: true,
    });

    // Enable WAL mode for better concurrent read/write performance
    await dbInstance.execAsync("PRAGMA journal_mode = WAL");

    // Enable foreign keys
    await dbInstance.execAsync("PRAGMA foreign_keys = ON");

    logger.debug("[Database] Opened successfully:", {
      databaseName: DATABASE_NAME,
    });
    return dbInstance;
  } catch (error) {
    logger.error("[Database] Failed to open:", error);
    throw error;
  }
}

/**
 * Gets the current database instance.
 * Throws if database hasn't been initialized.
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call openDatabase() first.");
  }
  return dbInstance;
}

/**
 * Closes the database connection.
 * Call this when the app goes to background for extended periods.
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
    logger.debug("[Database] Closed");
  }
}

/**
 * Initializes the database schema.
 * Creates all tables and indexes if they don't exist.
 */
export async function initializeSchema(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  logger.debug("[Database] Initializing schema...");

  try {
    // Create tables in dependency order
    for (const tableName of TABLE_CREATION_ORDER) {
      const sql = CREATE_TABLES_SQL[tableName];
      if (sql) {
        await db.execAsync(sql);
        logger.debug(`[Database] Created table: ${tableName}`);
      }
    }

    // Create indexes
    for (const indexSql of CREATE_INDEXES_SQL) {
      await db.execAsync(indexSql);
    }
    logger.debug(`[Database] Created ${CREATE_INDEXES_SQL.length} indexes`);

    // Initialize sync metadata for all syncable tables
    await initializeSyncMetadata(db);

    logger.debug("[Database] Schema initialized successfully");
  } catch (error) {
    logger.error("[Database] Schema initialization failed:", error);
    throw error;
  }
}

/**
 * Initializes sync metadata for all syncable tables.
 * Inserts default records if they don't exist.
 */
async function initializeSyncMetadata(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  for (const tableName of SYNCABLE_TABLES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO _sync_metadata (table_name, schema_version) VALUES (?, ?)`,
      [tableName, SCHEMA_VERSION],
    );
  }
  logger.debug("[Database] Sync metadata initialized");
}

/**
 * Gets the current schema version from the database.
 * Returns 0 if no version is set.
 */
export async function getSchemaVersion(
  db: SQLite.SQLiteDatabase,
): Promise<number> {
  try {
    const result = await db.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    return result?.user_version ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Sets the schema version in the database.
 */
export async function setSchemaVersion(
  db: SQLite.SQLiteDatabase,
  version: number,
): Promise<void> {
  await db.execAsync(`PRAGMA user_version = ${version}`);
}

/**
 * Checks if the database needs migration.
 */
export async function needsMigration(
  db: SQLite.SQLiteDatabase,
): Promise<boolean> {
  const currentVersion = await getSchemaVersion(db);
  return currentVersion < SCHEMA_VERSION;
}

/**
 * Runs a database integrity check.
 * Returns true if database is healthy, false if corrupted.
 */
export async function checkDatabaseIntegrity(
  db: SQLite.SQLiteDatabase,
): Promise<boolean> {
  try {
    const result = await db.getFirstAsync<{ integrity_check: string }>(
      "PRAGMA integrity_check",
    );
    const isHealthy = result?.integrity_check === "ok";
    if (!isHealthy) {
      logger.warn("[Database] Integrity check failed:", { result });
    }
    return isHealthy;
  } catch (error) {
    logger.error("[Database] Integrity check error:", error);
    return false;
  }
}

/**
 * Gets database statistics for debugging.
 */
export async function getDatabaseStats(
  db: SQLite.SQLiteDatabase,
): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};

  for (const tableName of SYNCABLE_TABLES) {
    try {
      const result = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE _deleted = 0`,
      );
      stats[tableName] = result?.count ?? 0;
    } catch {
      stats[tableName] = -1; // Table doesn't exist
    }
  }

  // Count pending sync operations
  try {
    const pending = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM _sync_queue WHERE status = 'pending'`,
    );
    stats._pending_sync = pending?.count ?? 0;
  } catch {
    stats._pending_sync = 0;
  }

  // Count dirty records
  try {
    let dirtyCount = 0;
    for (const tableName of SYNCABLE_TABLES) {
      const result = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE _dirty = 1`,
      );
      dirtyCount += result?.count ?? 0;
    }
    stats._dirty_records = dirtyCount;
  } catch {
    stats._dirty_records = 0;
  }

  return stats;
}

/**
 * Completely resets the database.
 * WARNING: This deletes all local data!
 */
export async function resetDatabase(): Promise<void> {
  logger.warn("[Database] Resetting database - all local data will be lost!");

  if (dbInstance) {
    await closeDatabase();
  }

  // Delete the database file
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);
  logger.debug("[Database] Database deleted");

  // Reinitialize
  const db = await openDatabase();
  await initializeSchema(db);
  await setSchemaVersion(db, SCHEMA_VERSION);
  logger.debug("[Database] Database reset complete");
}

/**
 * Full database initialization flow.
 * Call this once at app startup.
 * Uses a lock to prevent concurrent initialization (React Strict Mode).
 */
export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  // Return existing initialization if in progress (prevents race conditions)
  if (initPromise) {
    logger.debug("[Database] Initialization already in progress, waiting...");
    return initPromise;
  }

  // Return existing instance if already initialized
  if (dbInstance) {
    logger.debug("[Database] Already initialized, returning existing instance");
    return dbInstance;
  }

  // Start initialization with lock
  initPromise = (async () => {
    try {
      logger.debug("[Database] Starting initialization...");

      const db = await openDatabase();

      // Check integrity first
      const isHealthy = await checkDatabaseIntegrity(db);
      if (!isHealthy) {
        logger.warn("[Database] Corruption detected, resetting...");
        await resetDatabase();
        return openDatabase();
      }

      // Check if we need to initialize schema
      const version = await getSchemaVersion(db);
      if (version === 0) {
        // Fresh database
        await initializeSchema(db);
        await setSchemaVersion(db, SCHEMA_VERSION);
        logger.debug("[Database] Fresh database initialized");
      } else if (version < SCHEMA_VERSION) {
        // Needs migration
        logger.debug(
          `[Database] Migration needed: v${version} -> v${SCHEMA_VERSION}`,
        );
        // Migrations will be handled by migrations.ts
      } else {
        logger.debug(`[Database] Schema up to date (v${version})`);
      }

      const stats = await getDatabaseStats(db);
      logger.debug("[Database] Stats:", stats);

      return db;
    } finally {
      // Clear the lock after initialization completes (success or failure)
      initPromise = null;
    }
  })();

  return initPromise;
}
