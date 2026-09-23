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
import { getSchemaVersion, SCHEMA_VERSION, setSchemaVersion, SYNCABLE_TABLES } from "./schema";

// Import Drizzle-generated migrations
const drizzleMigrations = require("../../drizzle/migrations.js");

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
  // v0 -> v1: Initial schema from Drizzle
  //
  // Only migration 0000 is ever applied, and everything after it is a hand-written
  // step below. So the Drizzle snapshot has drifted from schema/*.ts on purpose -
  // tents dropped its unique() declaration and gained created_at in later steps,
  // while drizzle/0000_busy_menace.sql still describes the original shape. A
  // future `drizzle-kit generate` would emit a 0001 that nothing here executes:
  // append a hand-written migration instead, or regenerate the snapshot and be
  // sure 0000 still describes a v0 database.
  async (db) => {
    // Execute Drizzle-generated migration SQL
    const migration = drizzleMigrations.migrations[0];
    if (!migration) {
      throw new Error("Drizzle migration 0000 not found");
    }

    logger.debug(`[Migrations] Applying Drizzle migration: ${migration.name}`);

    // Split SQL by statement separator and execute
    const statements = migration.sql
      .split("--> statement-breakpoint")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    for (const statement of statements) {
      await db.execAsync(statement);
    }

    // Initialize sync metadata for all syncable tables
    for (const tableName of SYNCABLE_TABLES) {
      await db.runAsync(
        `INSERT OR IGNORE INTO _sync_metadata (table_name, schema_version) VALUES (?, ?)`,
        [tableName, SCHEMA_VERSION],
      );
    }

    logger.debug("[Migrations] Initial schema created from Drizzle migration");
  },

  // v1 -> v2: Add created_at to tent_visits (full timestamp for UI rendering).
  async (db) => {
    await addColumnIfNotExists(db, "tent_visits", "created_at", "TEXT");
  },

  // v2 -> v3: Allow more than one visit per tent per day.
  //
  // A day was modelled as a set of tents, so this index made "back at the tent I
  // was in this morning" unrepresentable on device. Dropping it is enough: the
  // constraint shipped as a standalone index (Drizzle migration 0000), not as an
  // inline table constraint, so no table rebuild and no row copying is needed.
  async (db) => {
    await dropIndexIfExists(db, "tent_visits_user_tent_festival_date");
  },

  // v3 -> v4: Drop the category CHECK that pre-Drizzle databases still carry.
  async (db) => {
    await rebuildLegacyAchievementsTable(db);
  },
];

/**
 * Rebuilds `achievements` without the CHECK constraints of the legacy DDL.
 *
 * Databases created before the Drizzle migration (builds up to #177) got their
 * tables from CREATE_TABLES_SQL, whose category CHECK predates the server's
 * `drinking` and `dedication` values. Every achievements pull on those devices
 * dies on the first such row. Drizzle's migration 0000 never ran there, since
 * the legacy path had already stamped user_version, so the old table is still
 * in place. Databases created by Drizzle have no CHECK and are left alone.
 *
 * SQLite cannot drop a constraint in place, so this is the create-copy-drop-
 * rename procedure. It runs inside the migration transaction, where
 * `foreign_keys = OFF` is a no-op, and `defer_foreign_keys` does not help
 * either: the drop counts every user_achievements row as a violation and rows
 * copied into the new table never pay that count back. So the child rows are
 * set aside while the parent is rebuilt, then restored against the new table.
 */
export async function rebuildLegacyAchievementsTable(
  db: Pick<SQLite.SQLiteDatabase, "execAsync" | "getFirstAsync">,
): Promise<void> {
  const table = await db.getFirstAsync<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'achievements'",
  );
  if (!table || !/\bCHECK\b/i.test(table.sql)) {
    logger.debug("achievements has no legacy CHECK, skipping rebuild");
    return;
  }

  await db.execAsync(
    "CREATE TEMP TABLE user_achievements_stash AS SELECT * FROM user_achievements",
  );
  await db.execAsync("DELETE FROM user_achievements");

  // Same shape as the table in Drizzle migration 0000.
  await db.execAsync(`
    CREATE TABLE achievements_new (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      category TEXT NOT NULL,
      rarity TEXT DEFAULT 'common',
      points INTEGER DEFAULT 0,
      conditions TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0 NOT NULL,
      _dirty INTEGER DEFAULT 0 NOT NULL
    )
  `);
  await db.execAsync(`
    INSERT INTO achievements_new (
      id, name, description, icon, category, rarity, points, conditions,
      is_active, created_at, updated_at, _synced_at, _deleted, _dirty
    )
    SELECT
      id, name, description, icon, category, rarity, points, conditions,
      is_active, created_at, updated_at, _synced_at,
      COALESCE(_deleted, 0), COALESCE(_dirty, 0)
    FROM achievements
  `);
  await db.execAsync("DROP TABLE achievements");
  await db.execAsync("ALTER TABLE achievements_new RENAME TO achievements");

  await db.execAsync("INSERT INTO user_achievements SELECT * FROM user_achievements_stash");
  await db.execAsync("DROP TABLE user_achievements_stash");
  logger.info("Rebuilt achievements without legacy CHECK constraints");
}

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
      throw new Error(`Missing migration function for v${version} -> v${version + 1}`);
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
      throw new Error(`Migration failed at v${version} -> v${version + 1}: ${error}`);
    }
  }

  logger.info("All migrations completed", { version: targetVersion });
}

/**
 * Checks if migrations are needed.
 */
export async function needsMigration(db: SQLite.SQLiteDatabase): Promise<boolean> {
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
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);

  const columnExists = columns.some((col) => col.name === columnName);

  if (columnExists) {
    logger.debug("Column already exists, skipping", { tableName, columnName });
    return false;
  }

  await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
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
export async function backupTable(db: SQLite.SQLiteDatabase, tableName: string): Promise<string> {
  const backupName = `${tableName}_backup_${Date.now()}`;
  await db.execAsync(`CREATE TABLE ${backupName} AS SELECT * FROM ${tableName}`);
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
export async function dropBackup(db: SQLite.SQLiteDatabase, backupName: string): Promise<void> {
  await db.execAsync(`DROP TABLE IF EXISTS ${backupName}`);
  logger.info("Dropped backup", { backupName });
}
