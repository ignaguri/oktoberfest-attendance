/**
 * SQLite Schema — Compatibility Layer
 *
 * This file re-exports types from the Drizzle ORM schema definitions and
 * maintains backward-compatible type aliases (Local*) for existing consumers.
 *
 * The source of truth for table definitions is now in ./schema/ directory.
 * DDL constants (CREATE_TABLES_SQL, CREATE_INDEXES_SQL) remain here temporarily
 * until init.ts migrates to Drizzle-managed migrations.
 */

// =============================================================================
// Type re-exports from Drizzle schema (source of truth)
// =============================================================================

// Enums
export type {
  AchievementCategory,
  AchievementRarity,
  DrinkType,
  FestivalStatus,
  FestivalType,
  PhotoVisibility,
  SyncOperationType,
  SyncStatus,
} from "./schema/enums";

// Drizzle table objects (for use in Drizzle queries)
export { achievements, userAchievements } from "./schema/achievements";
export { attendances } from "./schema/attendances";
export { beerPictures } from "./schema/beer-pictures";
export { consumptions } from "./schema/consumptions";
export { festivals } from "./schema/festivals";
export { groupMembers, groups } from "./schema/groups";
export { profiles } from "./schema/profiles";
export { syncMetadata, syncQueue } from "./schema/sync-tables";
export {
  drinkTypePrices,
  festivalTents,
  tents,
  tentVisits,
} from "./schema/tents";
export { winningCriteria } from "./schema/winning-criteria";

// =============================================================================
// Backward-compatible type aliases (Local* → Drizzle inferred types)
// These are used by consumers that haven't migrated to Drizzle queries yet.
// =============================================================================

import type { Achievement, UserAchievement } from "./schema/achievements";
import type { Attendance } from "./schema/attendances";
import type { BeerPicture } from "./schema/beer-pictures";
import type { Consumption } from "./schema/consumptions";
import type { Festival } from "./schema/festivals";
import type { Group, GroupMember } from "./schema/groups";
import type { Profile } from "./schema/profiles";
import type { SyncMetadataRow, SyncQueueRow } from "./schema/sync-tables";
import type {
  DrinkTypePrice,
  FestivalTent,
  Tent,
  TentVisit,
} from "./schema/tents";
import type { WinningCriteriaRow } from "./schema/winning-criteria";

export type LocalFestival = Festival;
export type LocalProfile = Profile;
export type LocalAttendance = Attendance;
export type LocalConsumption = Consumption;
export type LocalBeerPicture = BeerPicture;
export type LocalAchievement = Achievement;
export type LocalUserAchievement = UserAchievement;
export type LocalGroup = Group;
export type LocalGroupMember = GroupMember;
export type LocalTent = Tent;
export type LocalFestivalTent = FestivalTent;
export type LocalDrinkTypePrice = DrinkTypePrice;
export type LocalTentVisit = TentVisit;
export type LocalWinningCriteria = WinningCriteriaRow;
export type SyncMetadata = SyncMetadataRow;
export type SyncQueueItem = SyncQueueRow;

/**
 * Base offline fields interface.
 * For new code, prefer using `offlineColumns` from ./schema/common.ts with Drizzle.
 */
export interface OfflineFields {
  _synced_at: string | null;
  _deleted: number;
  _dirty: number;
}

// =============================================================================
// Table Name Safety
// =============================================================================

/** All syncable table names as a union type */
export type SyncableTable =
  | "festivals"
  | "profiles"
  | "tents"
  | "achievements"
  | "winning_criteria"
  | "festival_tents"
  | "drink_type_prices"
  | "groups"
  | "group_members"
  | "attendances"
  | "tent_visits"
  | "consumptions"
  | "beer_pictures"
  | "user_achievements";

/** Tables that support user mutations (can be dirty) */
export type MutableTable =
  | "profiles"
  | "attendances"
  | "consumptions"
  | "beer_pictures"
  | "tent_visits"
  | "group_members"
  | "user_achievements";

// =============================================================================
// Constants
// =============================================================================

export const SCHEMA_VERSION = 1;
export const DATABASE_NAME = "prostcounter.db";

// =============================================================================
// Schema Version Helpers
// Placed here (not in init.ts) to avoid circular deps with migrations.ts
// =============================================================================

import type * as SQLite from "expo-sqlite";

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

export const SYNCABLE_TABLES: readonly SyncableTable[] = [
  "festivals",
  "profiles",
  "tents",
  "achievements",
  "winning_criteria",
  "festival_tents",
  "drink_type_prices",
  "groups",
  "group_members",
  "attendances",
  "tent_visits",
  "consumptions",
  "beer_pictures",
  "user_achievements",
];

export const MUTABLE_TABLES: readonly MutableTable[] = [
  "profiles",
  "attendances",
  "consumptions",
  "beer_pictures",
  "tent_visits",
  "group_members",
  "user_achievements",
];

export const REFERENCE_TABLES: readonly string[] = [
  "festivals",
  "tents",
  "achievements",
  "winning_criteria",
  "festival_tents",
  "drink_type_prices",
  "groups",
];

/** Runtime validation for table names used in dynamic SQL */
const VALID_TABLE_NAMES = new Set<string>([
  ...SYNCABLE_TABLES,
  "_sync_metadata",
  "_sync_queue",
]);

export function assertValidTable(name: string): asserts name is SyncableTable {
  if (!VALID_TABLE_NAMES.has(name)) {
    throw new Error(`Invalid table name: ${name}`);
  }
}

// =============================================================================
// DDL Constants (will be replaced by Drizzle migrations)
// =============================================================================

export const CREATE_TABLES_SQL: Record<string, string> = {
  _sync_metadata: `
    CREATE TABLE IF NOT EXISTS _sync_metadata (
      table_name TEXT PRIMARY KEY,
      last_sync_at TEXT,
      last_pull_cursor TEXT,
      schema_version INTEGER DEFAULT 1
    )
  `,

  _sync_queue: `
    CREATE TABLE IF NOT EXISTS _sync_queue (
      id TEXT PRIMARY KEY,
      operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE', 'UPLOAD_FILE')),
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      idempotency_key TEXT,
      depends_on TEXT REFERENCES _sync_queue(id),
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'failed', 'completed')),
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL
    )
  `,

  festivals: `
    CREATE TABLE IF NOT EXISTS festivals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      description TEXT,
      location TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      festival_type TEXT NOT NULL CHECK (festival_type IN ('oktoberfest', 'starkbierfest', 'fruehlingsfest', 'other')),
      status TEXT NOT NULL CHECK (status IN ('upcoming', 'active', 'ended')),
      is_active INTEGER DEFAULT 1,
      beer_cost REAL,
      default_beer_price_cents INTEGER,
      timezone TEXT DEFAULT 'Europe/Berlin',
      map_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0,
      _dirty INTEGER DEFAULT 0
    )
  `,

  profiles: `
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      username TEXT,
      full_name TEXT,
      avatar_url TEXT,
      website TEXT,
      preferred_language TEXT,
      tutorial_completed INTEGER,
      tutorial_completed_at TEXT,
      is_super_admin INTEGER,
      updated_at TEXT,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0,
      _dirty INTEGER DEFAULT 0
    )
  `,

  attendances: `
    CREATE TABLE IF NOT EXISTS attendances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      festival_id TEXT NOT NULL REFERENCES festivals(id),
      date TEXT NOT NULL,
      beer_count INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0,
      _dirty INTEGER DEFAULT 0,
      UNIQUE(user_id, festival_id, date)
    )
  `,

  consumptions: `
    CREATE TABLE IF NOT EXISTS consumptions (
      id TEXT PRIMARY KEY,
      attendance_id TEXT NOT NULL REFERENCES attendances(id),
      drink_type TEXT DEFAULT 'beer' CHECK (drink_type IN ('beer', 'radler', 'alcohol_free', 'wine', 'soft_drink', 'other')),
      drink_name TEXT,
      volume_ml INTEGER,
      price_paid_cents INTEGER NOT NULL,
      base_price_cents INTEGER NOT NULL,
      tip_cents INTEGER,
      tent_id TEXT REFERENCES tents(id),
      recorded_at TEXT NOT NULL,
      idempotency_key TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0,
      _dirty INTEGER DEFAULT 0
    )
  `,

  beer_pictures: `
    CREATE TABLE IF NOT EXISTS beer_pictures (
      id TEXT PRIMARY KEY,
      attendance_id TEXT NOT NULL REFERENCES attendances(id),
      user_id TEXT NOT NULL,
      picture_url TEXT,
      visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
      created_at TEXT NOT NULL,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0,
      _dirty INTEGER DEFAULT 0,
      _pending_upload INTEGER DEFAULT 0,
      _local_uri TEXT
    )
  `,

  achievements: `
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('consumption', 'attendance', 'explorer', 'social', 'competitive', 'special')),
      rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
      points INTEGER DEFAULT 0,
      conditions TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0,
      _dirty INTEGER DEFAULT 0
    )
  `,

  user_achievements: `
    CREATE TABLE IF NOT EXISTS user_achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      achievement_id TEXT NOT NULL REFERENCES achievements(id),
      festival_id TEXT NOT NULL REFERENCES festivals(id),
      unlocked_at TEXT NOT NULL,
      progress TEXT,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0,
      _dirty INTEGER DEFAULT 0,
      UNIQUE(user_id, achievement_id, festival_id)
    )
  `,

  groups: `
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      festival_id TEXT NOT NULL REFERENCES festivals(id),
      created_by TEXT,
      password TEXT NOT NULL,
      invite_token TEXT,
      token_expiration TEXT,
      winning_criteria_id INTEGER NOT NULL,
      created_at TEXT,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0,
      _dirty INTEGER DEFAULT 0
    )
  `,

  group_members: `
    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id),
      user_id TEXT NOT NULL,
      joined_at TEXT,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0,
      _dirty INTEGER DEFAULT 0,
      UNIQUE(group_id, user_id)
    )
  `,

  tents: `
    CREATE TABLE IF NOT EXISTS tents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0,
      _dirty INTEGER DEFAULT 0
    )
  `,

  festival_tents: `
    CREATE TABLE IF NOT EXISTS festival_tents (
      id TEXT PRIMARY KEY,
      festival_id TEXT NOT NULL REFERENCES festivals(id),
      tent_id TEXT NOT NULL REFERENCES tents(id),
      beer_price REAL,
      beer_price_cents INTEGER,
      created_at TEXT,
      updated_at TEXT,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0,
      _dirty INTEGER DEFAULT 0,
      UNIQUE(festival_id, tent_id)
    )
  `,

  drink_type_prices: `
    CREATE TABLE IF NOT EXISTS drink_type_prices (
      id TEXT PRIMARY KEY,
      drink_type TEXT NOT NULL CHECK (drink_type IN ('beer', 'radler', 'alcohol_free', 'wine', 'soft_drink', 'other')),
      price_cents INTEGER NOT NULL,
      festival_id TEXT REFERENCES festivals(id),
      festival_tent_id TEXT REFERENCES festival_tents(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0,
      _dirty INTEGER DEFAULT 0
    )
  `,

  tent_visits: `
    CREATE TABLE IF NOT EXISTS tent_visits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      tent_id TEXT NOT NULL REFERENCES tents(id),
      festival_id TEXT NOT NULL REFERENCES festivals(id),
      visit_date TEXT,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0,
      _dirty INTEGER DEFAULT 0,
      UNIQUE(user_id, tent_id, festival_id, visit_date)
    )
  `,

  winning_criteria: `
    CREATE TABLE IF NOT EXISTS winning_criteria (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      _synced_at TEXT,
      _deleted INTEGER DEFAULT 0,
      _dirty INTEGER DEFAULT 0
    )
  `,
};

export const CREATE_INDEXES_SQL: string[] = [
  "CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON _sync_queue(status, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_sync_queue_depends ON _sync_queue(depends_on)",
  "CREATE INDEX IF NOT EXISTS idx_attendances_user_festival ON attendances(user_id, festival_id)",
  "CREATE INDEX IF NOT EXISTS idx_attendances_date ON attendances(date)",
  "CREATE INDEX IF NOT EXISTS idx_attendances_dirty ON attendances(_dirty) WHERE _dirty = 1",
  "CREATE INDEX IF NOT EXISTS idx_consumptions_attendance ON consumptions(attendance_id)",
  "CREATE INDEX IF NOT EXISTS idx_consumptions_idempotency ON consumptions(idempotency_key)",
  "CREATE INDEX IF NOT EXISTS idx_consumptions_dirty ON consumptions(_dirty) WHERE _dirty = 1",
  "CREATE INDEX IF NOT EXISTS idx_beer_pictures_attendance ON beer_pictures(attendance_id)",
  "CREATE INDEX IF NOT EXISTS idx_beer_pictures_pending ON beer_pictures(_pending_upload) WHERE _pending_upload = 1",
  "CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id)",
  "CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id, festival_id)",
  "CREATE INDEX IF NOT EXISTS idx_tent_visits_user_festival ON tent_visits(user_id, festival_id)",
  "CREATE INDEX IF NOT EXISTS idx_festival_tents_festival ON festival_tents(festival_id)",
];

export const TABLE_CREATION_ORDER: string[] = [
  "_sync_metadata",
  "_sync_queue",
  "festivals",
  "profiles",
  "tents",
  "achievements",
  "winning_criteria",
  "festival_tents",
  "drink_type_prices",
  "groups",
  "attendances",
  "group_members",
  "tent_visits",
  "consumptions",
  "beer_pictures",
  "user_achievements",
];
