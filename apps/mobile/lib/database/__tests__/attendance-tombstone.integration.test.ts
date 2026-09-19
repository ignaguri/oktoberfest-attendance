/**
 * Runs createOrResurrectLocalAttendance against a real SQLite database.
 *
 * The constraint is the whole point. attendances carries
 * UNIQUE(user_id, festival_id, date) and `_deleted` is not part of it, so a
 * soft-deleted day still owns the slot while being invisible to the
 * `_deleted = 0` lookups that decide the day is missing. Inserting over one
 * raises SQLite error 19 and the drink is lost, permanently, because nothing
 * purges tombstones - a real user spent two hours unable to log a beer that
 * way. A mocked db cannot reproduce it: only a real database enforces the
 * constraint, and the bug lives entirely inside that enforcement.
 */
import Database from "better-sqlite3";
import type * as SQLite from "expo-sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CREATE_TABLES_SQL } from "../schema";
import { createOrResurrectLocalAttendance } from "../sync-queue";

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const USER = "u1";
const OTHER_USER = "u2";
const FESTIVAL = "f1";
const DATE = "2026-09-19";
const NOW = "2026-09-19T12:42:21.524Z";

/** Adapts better-sqlite3's synchronous API to the async surface the SQL needs. */
function createDb(database: Database.Database): SQLite.SQLiteDatabase {
  return {
    getFirstAsync: async (sql: string, ...params: unknown[]) =>
      database.prepare(sql).get(...flatten(params)) ?? null,
    getAllAsync: async (sql: string, ...params: unknown[]) =>
      database.prepare(sql).all(...flatten(params)),
    runAsync: async (sql: string, ...params: unknown[]) =>
      database.prepare(sql).run(...flatten(params)),
  } as unknown as SQLite.SQLiteDatabase;
}

/** The production calls pass a single array of bind params. */
function flatten(params: unknown[]): unknown[] {
  return params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
}

interface AttendanceRow {
  id: string;
  user_id: string;
  beer_count: number;
  _deleted: number;
  _dirty: number;
  updated_at: string;
}

function insertAttendance(
  database: Database.Database,
  params: {
    id: string;
    userId?: string;
    date?: string;
    beerCount?: number;
    deleted: number;
  },
): void {
  database
    .prepare(
      `INSERT INTO attendances
        (id, user_id, festival_id, date, beer_count,
         created_at, updated_at, _synced_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(
      params.id,
      params.userId ?? USER,
      FESTIVAL,
      params.date ?? DATE,
      params.beerCount ?? 0,
      NOW,
      NOW,
      NOW,
      params.deleted,
    );
}

function allAttendances(database: Database.Database): AttendanceRow[] {
  return database
    .prepare(`SELECT * FROM attendances ORDER BY id`)
    .all() as unknown as AttendanceRow[];
}

describe("createOrResurrectLocalAttendance", () => {
  let database: Database.Database;
  let db: SQLite.SQLiteDatabase;

  beforeEach(() => {
    database = new Database(":memory:");
    for (const sql of Object.values(CREATE_TABLES_SQL)) {
      database.exec(sql);
    }
    database
      .prepare(
        `INSERT INTO festivals
          (id, name, short_name, location, start_date, end_date,
           festival_type, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'oktoberfest', 'active', ?, ?)`,
      )
      .run(FESTIVAL, "Oktoberfest 2026", "O'26", "Munich", "2026-09-19", "2026-10-04", NOW, NOW);
    db = createDb(database);
  });

  it("creates the day when nothing occupies the slot", async () => {
    const id = await createOrResurrectLocalAttendance(db, {
      userId: USER,
      festivalId: FESTIVAL,
      date: DATE,
      now: NOW,
    });

    const rows = allAttendances(database);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0]._deleted).toBe(0);
    // Unsynced, so the caller's enqueued INSERT still has work to push.
    expect(rows[0]._dirty).toBe(1);
  });

  it("resurrects a tombstone instead of failing the UNIQUE constraint", async () => {
    insertAttendance(database, { id: "att-dead", beerCount: 7, deleted: 1 });

    const id = await createOrResurrectLocalAttendance(db, {
      userId: USER,
      festivalId: FESTIVAL,
      date: DATE,
      now: NOW,
    });

    // Reusing the row is what keeps the insert off the occupied slot.
    expect(id).toBe("att-dead");

    const rows = allAttendances(database);
    expect(rows).toHaveLength(1);
    expect(rows[0]._deleted).toBe(0);
    expect(rows[0]._dirty).toBe(1);
    // The day starts over: its old drinks were soft-deleted with it.
    expect(rows[0].beer_count).toBe(0);
    expect(rows[0].updated_at).toBe(NOW);
  });

  it("leaves another account's row for the same day alone", async () => {
    insertAttendance(database, { id: "att-other", userId: OTHER_USER, deleted: 1 });

    const id = await createOrResurrectLocalAttendance(db, {
      userId: USER,
      festivalId: FESTIVAL,
      date: DATE,
      now: NOW,
    });

    expect(id).not.toBe("att-other");

    const rows = allAttendances(database);
    expect(rows).toHaveLength(2);
    // The other account's tombstone is not this user's to revive.
    expect(rows.find((row) => row.id === "att-other")?._deleted).toBe(1);
  });

  it("does not touch a tombstone from a different date", async () => {
    insertAttendance(database, { id: "att-yesterday", date: "2026-09-18", deleted: 1 });

    const id = await createOrResurrectLocalAttendance(db, {
      userId: USER,
      festivalId: FESTIVAL,
      date: DATE,
      now: NOW,
    });

    expect(id).not.toBe("att-yesterday");
    expect(allAttendances(database)).toHaveLength(2);
    expect(
      allAttendances(database).find((row) => row.id === "att-yesterday")?._deleted,
    ).toBe(1);
  });

  it("reproduces the original failure: a bare insert over a tombstone throws", async () => {
    insertAttendance(database, { id: "att-dead", deleted: 1 });

    // This is what the code did before: the `_deleted = 0` lookup misses the
    // tombstone, so a fresh id goes straight into the occupied slot.
    expect(() =>
      insertAttendance(database, { id: "att-new", deleted: 0 }),
    ).toThrow(/UNIQUE constraint failed/);
  });
});
