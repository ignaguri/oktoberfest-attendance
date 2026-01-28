/**
 * Database Migrations
 *
 * Handles schema migrations when the database schema version changes.
 * Each migration function transforms the database from version N to N+1.
 *
 * Guidelines for adding new migrations:
 * 1. Add a new migration function (e.g., migrateV2ToV3)
 * 2. Add the function to the MIGRATIONS array
 * 3. Increment SCHEMA_VERSION in schema.ts
 * 4. Migrations must be idempotent (safe to run multiple times)
 * 5. Never modify existing migrations - only add new ones
 */

import type * as SQLite from "expo-sqlite";

import { logger } from "../logger";
import { getSchemaVersion, initializeSchema, setSchemaVersion } from "./init";
import { SCHEMA_VERSION } from "./schema";

/**
 * Migration function type.
 * Takes a database and migrates it from one version to the next.
 */
type MigrationFn = (db: SQLite.SQLiteDatabase) => Promise<void>;

/**
 * Array of migration functions.
 * Index 0 migrates from v0 to v1, index 1 from v1 to v2, etc.
 *
 * IMPORTANT: Never modify existing migrations. Only append new ones.
 */
const MIGRATIONS: MigrationFn[] = [
  // v0 -> v1: Initial schema (handled by initializeSchema)
  async (db) => {
    // This is a special case - if coming from v0 (no schema),
    // we just initialize the full schema rather than migrating
    await initializeSchema(db);
  },

  // Future migrations go here:
  // v1 -> v2: Example migration
  // async (db) => {
  //   await db.execAsync(`
  //     ALTER TABLE attendances ADD COLUMN notes TEXT;
  //   `);
  // },
];

/**
 * Runs all pending migrations.
 * Executes migrations sequentially from current version to target version.
 */
export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const currentVersion = await getSchemaVersion(db);
  const targetVersion = SCHEMA_VERSION;

  if (currentVersion >= targetVersion) {
    logger.info("No migrations needed", { currentVersion, targetVersion });
    return;
  }

  logger.info("Running migrations", { currentVersion, targetVersion });

  // Run each migration in sequence
  for (let version = currentVersion; version < targetVersion; version++) {
    const migrationIndex = version;
    const migration = MIGRATIONS[migrationIndex];

    if (!migration) {
      throw new Error(
        `Missing migration function for v${version} -> v${version + 1}`,
      );
    }

    logger.info("Running migration", { from: version, to: version + 1 });

    try {
      // Run migration in a transaction for atomicity
      await db.withTransactionAsync(async () => {
        await migration(db);
      });

      // Update schema version after successful migration
      await setSchemaVersion(db, version + 1);
      logger.info("Completed migration", { version: version + 1 });
    } catch (error) {
      logger.error("Migration failed", {
        error,
        from: version,
        to: version + 1,
      });
      throw new Error(
        `Migration failed at v${version} -> v${version + 1}: ${error}`,
      );
    }
  }

  logger.info("All migrations completed", { version: targetVersion });
}

/**
 * Checks if migrations are needed.
 */
export async function needsMigration(
  db: SQLite.SQLiteDatabase,
): Promise<boolean> {
  const currentVersion = await getSchemaVersion(db);
  return currentVersion < SCHEMA_VERSION;
}

/**
 * Gets migration status for debugging.
 */
export async function getMigrationStatus(db: SQLite.SQLiteDatabase): Promise<{
  currentVersion: number;
  targetVersion: number;
  pendingMigrations: number;
}> {
  const currentVersion = await getSchemaVersion(db);
  return {
    currentVersion,
    targetVersion: SCHEMA_VERSION,
    pendingMigrations: Math.max(0, SCHEMA_VERSION - currentVersion),
  };
}

// =============================================================================
// Migration Utilities
// =============================================================================

/**
 * Safely adds a column to a table if it doesn't exist.
 * SQLite doesn't support IF NOT EXISTS for ALTER TABLE,
 * so we check the schema first.
 */
export async function addColumnIfNotExists(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
  columnDef: string,
): Promise<boolean> {
  // Check if column exists
  const columns = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${tableName})`,
  );

  const columnExists = columns.some((col) => col.name === columnName);

  if (columnExists) {
    logger.debug("Column already exists, skipping", { tableName, columnName });
    return false;
  }

  await db.execAsync(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`,
  );
  logger.info("Added column", { tableName, columnName });
  return true;
}

/**
 * Safely creates an index if it doesn't exist.
 */
export async function createIndexIfNotExists(
  db: SQLite.SQLiteDatabase,
  indexName: string,
  tableName: string,
  columns: string[],
  whereClause?: string,
): Promise<void> {
  const whereStr = whereClause ? ` WHERE ${whereClause}` : "";
  await db.execAsync(
    `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${columns.join(", ")})${whereStr}`,
  );
}

/**
 * Safely drops an index if it exists.
 */
export async function dropIndexIfExists(
  db: SQLite.SQLiteDatabase,
  indexName: string,
): Promise<void> {
  await db.execAsync(`DROP INDEX IF EXISTS ${indexName}`);
}

/**
 * Renames a table.
 * SQLite supports this natively.
 */
export async function renameTable(
  db: SQLite.SQLiteDatabase,
  oldName: string,
  newName: string,
): Promise<void> {
  await db.execAsync(`ALTER TABLE ${oldName} RENAME TO ${newName}`);
  logger.info("Renamed table", { oldName, newName });
}

/**
 * Creates a backup of a table before migration.
 * Useful for complex migrations that might fail.
 */
export async function backupTable(
  db: SQLite.SQLiteDatabase,
  tableName: string,
): Promise<string> {
  const backupName = `${tableName}_backup_${Date.now()}`;
  await db.execAsync(
    `CREATE TABLE ${backupName} AS SELECT * FROM ${tableName}`,
  );
  logger.info("Created backup", { backupName });
  return backupName;
}

/**
 * Restores a table from a backup.
 */
export async function restoreFromBackup(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  backupName: string,
): Promise<void> {
  await db.execAsync(`DROP TABLE IF EXISTS ${tableName}`);
  await db.execAsync(`ALTER TABLE ${backupName} RENAME TO ${tableName}`);
  logger.info("Restored table from backup", { tableName, backupName });
}

/**
 * Drops a backup table after successful migration.
 */
export async function dropBackup(
  db: SQLite.SQLiteDatabase,
  backupName: string,
): Promise<void> {
  await db.execAsync(`DROP TABLE IF EXISTS ${backupName}`);
  logger.info("Dropped backup", { backupName });
}
