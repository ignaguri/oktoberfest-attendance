/**
 * Runs the v3 -> v4 achievements rebuild against a real SQLite database.
 *
 * The bug only exists on devices whose database was built by the pre-Drizzle
 * DDL, so the legacy table below is that DDL verbatim, CHECK included. The
 * rebuild runs the way runMigrations runs it: inside a transaction with foreign
 * keys on, which is exactly where a naive `foreign_keys = OFF` would silently
 * do nothing.
 */
import Database from "better-sqlite3";
import type * as SQLite from "expo-sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rebuildLegacyAchievementsTable } from "../migrations";

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Verbatim from CREATE_TABLES_SQL before the fix.
const LEGACY_ACHIEVEMENTS_SQL = `
  CREATE TABLE achievements (
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
`;

const DRIZZLE_ACHIEVEMENTS_SQL = `
  CREATE TABLE achievements (
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
`;

const USER_ACHIEVEMENTS_SQL = `
  CREATE TABLE user_achievements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL REFERENCES achievements(id),
    festival_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL
  )
`;

const TS = "2026-08-06T09:21:57Z";

/** Adapts better-sqlite3's synchronous API to the async surface the migration needs. */
function createDb(
  database: Database.Database,
): Pick<SQLite.SQLiteDatabase, "execAsync" | "getFirstAsync"> {
  return {
    execAsync: async (sql: string) => {
      database.exec(sql);
    },
    getFirstAsync: (async (sql: string) => database.prepare(sql).get() ?? null) as never,
  };
}

function insertAchievement(database: Database.Database, id: string, category: string): void {
  database
    .prepare(
      `INSERT INTO achievements (id, name, description, icon, category, created_at, updated_at)
       VALUES (?, ?, 'desc', 'icon', ?, ?, ?)`,
    )
    .run(id, id, category, TS, TS);
}

async function migrateInTransaction(database: Database.Database): Promise<void> {
  database.exec("BEGIN");
  await rebuildLegacyAchievementsTable(createDb(database));
  database.exec("COMMIT");
}

function achievementsSql(database: Database.Database): string {
  return (
    database.prepare("SELECT sql FROM sqlite_master WHERE name = 'achievements'").get() as {
      sql: string;
    }
  ).sql;
}

describe("rebuildLegacyAchievementsTable", () => {
  let database: Database.Database;

  beforeEach(() => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
  });

  afterEach(() => {
    database.close();
  });

  describe("on a legacy database", () => {
    beforeEach(() => {
      database.exec(LEGACY_ACHIEVEMENTS_SQL);
      database.exec(USER_ACHIEVEMENTS_SQL);
      insertAchievement(database, "a1", "social");
      database
        .prepare(
          `INSERT INTO user_achievements (id, user_id, achievement_id, festival_id, unlocked_at)
           VALUES ('ua1', 'u1', 'a1', 'f1', ?)`,
        )
        .run(TS);
    });

    it("rejects the server's newer categories before the rebuild", () => {
      expect(() => insertAchievement(database, "a2", "drinking")).toThrow(
        /CHECK constraint failed/,
      );
    });

    it("accepts drinking and dedication after the rebuild", async () => {
      await migrateInTransaction(database);

      insertAchievement(database, "a2", "drinking");
      insertAchievement(database, "a3", "dedication");

      expect(achievementsSql(database)).not.toMatch(/CHECK/i);
      expect(database.prepare("SELECT id FROM achievements ORDER BY id").all()).toEqual([
        { id: "a1" },
        { id: "a2" },
        { id: "a3" },
      ]);
    });

    it("keeps existing rows and the user_achievements foreign key", async () => {
      await migrateInTransaction(database);

      expect(database.prepare("SELECT category FROM achievements WHERE id = 'a1'").get()).toEqual({
        category: "social",
      });
      expect(database.prepare("SELECT id, achievement_id FROM user_achievements").all()).toEqual([
        { id: "ua1", achievement_id: "a1" },
      ]);
      expect(database.pragma("foreign_key_check")).toEqual([]);
      expect(() =>
        database
          .prepare(
            `INSERT INTO user_achievements (id, user_id, achievement_id, festival_id, unlocked_at)
             VALUES ('ua2', 'u1', 'missing', 'f1', ?)`,
          )
          .run(TS),
      ).toThrow(/FOREIGN KEY constraint failed/);
    });
  });

  it("leaves a Drizzle-created table untouched", async () => {
    database.exec(DRIZZLE_ACHIEVEMENTS_SQL);
    insertAchievement(database, "a1", "drinking");
    const before = achievementsSql(database);

    await migrateInTransaction(database);

    expect(achievementsSql(database)).toBe(before);
    expect(database.prepare("SELECT COUNT(*) AS n FROM achievements").get()).toEqual({ n: 1 });
  });
});
