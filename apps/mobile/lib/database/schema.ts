/**
 * SQLite Schema for Offline-First Storage
 *
 * Mirrors the Supabase schema with additional offline-specific fields:
 * - _synced_at: Last sync timestamp (ISO 8601)
 * - _deleted: Soft delete flag (0=active, 1=deleted)
 * - _dirty: Pending changes flag (0=synced, 1=needs push)
 * - _pending_upload: For photos - local file not yet uploaded
 * - _local_uri: For photos - local file path for pending uploads
 */

// =============================================================================
// Enums (mirroring Supabase enums)
// =============================================================================

export type DrinkType =
  | "beer"
  | "radler"
  | "alcohol_free"
  | "wine"
  | "soft_drink"
  | "other";

export type PhotoVisibility = "public" | "private";

export type FestivalStatus = "upcoming" | "active" | "ended";

export type FestivalType =
  | "oktoberfest"
  | "starkbierfest"
  | "fruehlingsfest"
  | "other";

export type AchievementCategory =
  | "consumption"
  | "attendance"
  | "explorer"
  | "social"
  | "competitive"
  | "special";

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

export type SyncOperationType = "INSERT" | "UPDATE" | "DELETE" | "UPLOAD_FILE";

export type SyncStatus = "pending" | "processing" | "failed" | "completed";

// =============================================================================
// Base Offline Fields (added to all synced tables)
// =============================================================================

export interface OfflineFields {
  _synced_at: string | null;
  _deleted: number; // 0 = active, 1 = deleted
  _dirty: number; // 0 = synced, 1 = needs push
}

// =============================================================================
// Priority 1: Core Tables (Must Work Offline)
// =============================================================================

export interface LocalFestival extends OfflineFields {
  id: string;
  name: string;
  short_name: string;
  description: string | null;
  location: string;
  start_date: string;
  end_date: string;
  festival_type: FestivalType;
  status: FestivalStatus;
  is_active: number; // SQLite boolean
  beer_cost: number | null;
  default_beer_price_cents: number | null;
  timezone: string;
  map_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalProfile extends OfflineFields {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  website: string | null;
  preferred_language: string | null;
  tutorial_completed: number | null; // SQLite boolean
  tutorial_completed_at: string | null;
  is_super_admin: number | null; // SQLite boolean
  updated_at: string | null;
}

export interface LocalAttendance extends OfflineFields {
  id: string;
  user_id: string;
  festival_id: string;
  date: string;
  beer_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface LocalConsumption extends OfflineFields {
  id: string;
  attendance_id: string;
  drink_type: DrinkType;
  drink_name: string | null;
  volume_ml: number | null;
  price_paid_cents: number;
  base_price_cents: number;
  tip_cents: number | null;
  tent_id: string | null;
  recorded_at: string;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalBeerPicture extends OfflineFields {
  id: string;
  attendance_id: string;
  user_id: string;
  picture_url: string | null; // null when pending upload
  visibility: PhotoVisibility;
  created_at: string;
  // Photo-specific offline fields
  _pending_upload: number; // 0 = uploaded, 1 = pending
  _local_uri: string | null; // Local file path for pending uploads
}

export interface LocalAchievement extends OfflineFields {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  points: number;
  conditions: string; // JSON string
  is_active: number; // SQLite boolean
  created_at: string;
  updated_at: string;
}

export interface LocalUserAchievement extends OfflineFields {
  id: string;
  user_id: string;
  achievement_id: string;
  festival_id: string;
  unlocked_at: string;
  progress: string | null; // JSON string
}

// =============================================================================
// Priority 2: Group Features
// =============================================================================

export interface LocalGroup extends OfflineFields {
  id: string;
  name: string;
  description: string | null;
  festival_id: string;
  created_by: string | null;
  password: string;
  invite_token: string | null;
  token_expiration: string | null;
  winning_criteria_id: number;
  created_at: string | null;
}

export interface LocalGroupMember extends OfflineFields {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string | null;
}

// =============================================================================
// Priority 3: Reference/Settings Data
// =============================================================================

export interface LocalTent extends OfflineFields {
  id: string;
  name: string;
  category: string | null;
}

export interface LocalFestivalTent extends OfflineFields {
  id: string;
  festival_id: string;
  tent_id: string;
  beer_price: number | null;
  beer_price_cents: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface LocalDrinkTypePrice extends OfflineFields {
  id: string;
  drink_type: DrinkType;
  price_cents: number;
  festival_id: string | null;
  festival_tent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalTentVisit extends OfflineFields {
  id: string;
  user_id: string;
  tent_id: string;
  festival_id: string;
  visit_date: string | null;
}

export interface LocalWinningCriteria extends OfflineFields {
  id: number;
  name: string;
}

// =============================================================================
// Sync Metadata Tables
// =============================================================================

export interface SyncMetadata {
  table_name: string;
  last_sync_at: string | null;
  last_pull_cursor: string | null;
  schema_version: number;
}

export interface SyncQueueItem {
  id: string;
  operation: SyncOperationType;
  table_name: string;
  record_id: string;
  payload: string; // JSON string
  idempotency_key: string | null;
  depends_on: string | null; // FK to sync_queue.id
  status: SyncStatus;
  retry_count: number;
  last_error: string | null;
  created_at: string;
}

// =============================================================================
// SQL Schema Definitions
// =============================================================================

/**
 * Current schema version - increment when making breaking changes
 */
export const SCHEMA_VERSION = 1;

/**
 * Database file name
 */
export const DATABASE_NAME = "prostcounter.db";

/**
 * SQL statements to create all tables
 */
export const CREATE_TABLES_SQL: Record<string, string> = {
  // Sync metadata tables
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

  // Priority 1: Core tables
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

  // Priority 2: Group tables
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

  // Priority 3: Reference tables
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

/**
 * Indexes for better query performance
 */
export const CREATE_INDEXES_SQL: string[] = [
  // Sync queue indexes
  "CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON _sync_queue(status, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_sync_queue_depends ON _sync_queue(depends_on)",

  // Attendance indexes
  "CREATE INDEX IF NOT EXISTS idx_attendances_user_festival ON attendances(user_id, festival_id)",
  "CREATE INDEX IF NOT EXISTS idx_attendances_date ON attendances(date)",
  "CREATE INDEX IF NOT EXISTS idx_attendances_dirty ON attendances(_dirty) WHERE _dirty = 1",

  // Consumption indexes
  "CREATE INDEX IF NOT EXISTS idx_consumptions_attendance ON consumptions(attendance_id)",
  "CREATE INDEX IF NOT EXISTS idx_consumptions_idempotency ON consumptions(idempotency_key)",
  "CREATE INDEX IF NOT EXISTS idx_consumptions_dirty ON consumptions(_dirty) WHERE _dirty = 1",

  // Beer pictures indexes
  "CREATE INDEX IF NOT EXISTS idx_beer_pictures_attendance ON beer_pictures(attendance_id)",
  "CREATE INDEX IF NOT EXISTS idx_beer_pictures_pending ON beer_pictures(_pending_upload) WHERE _pending_upload = 1",

  // Group member indexes
  "CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id)",

  // User achievements indexes
  "CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id, festival_id)",

  // Tent visits indexes
  "CREATE INDEX IF NOT EXISTS idx_tent_visits_user_festival ON tent_visits(user_id, festival_id)",

  // Festival tents indexes
  "CREATE INDEX IF NOT EXISTS idx_festival_tents_festival ON festival_tents(festival_id)",
];

/**
 * Order for table creation (respects foreign key dependencies)
 */
export const TABLE_CREATION_ORDER: string[] = [
  // Metadata tables first
  "_sync_metadata",
  "_sync_queue",
  // Reference tables (no dependencies)
  "festivals",
  "profiles",
  "tents",
  "achievements",
  "winning_criteria",
  // Tables with dependencies on reference tables
  "festival_tents",
  "drink_type_prices",
  "groups",
  "attendances",
  // Tables with deeper dependencies
  "group_members",
  "tent_visits",
  "consumptions",
  "beer_pictures",
  "user_achievements",
];

/**
 * Tables that should be synced (in dependency order)
 */
export const SYNCABLE_TABLES: string[] = [
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

/**
 * Tables that support user mutations (can be dirty)
 */
export const MUTABLE_TABLES: string[] = [
  "profiles",
  "attendances",
  "consumptions",
  "beer_pictures",
  "tent_visits",
  "group_members",
  "user_achievements",
];

/**
 * Reference tables that are read-only on client
 */
export const REFERENCE_TABLES: string[] = [
  "festivals",
  "tents",
  "achievements",
  "winning_criteria",
  "festival_tents",
  "drink_type_prices",
  "groups",
];
