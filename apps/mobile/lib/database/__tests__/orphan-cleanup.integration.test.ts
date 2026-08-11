/**
 * Runs the orphan-cleanup SQL in ../sync-queue against a real SQLite database.
 *
 * The age floor is the part worth pinning. Rows store created_at as an ISO
 * string ("2026-08-11T06:00:00.000Z") while datetime('now', ?) produces
 * "2026-08-11 05:00:00", so a naive TEXT comparison sorts every ISO string above
 * any same-day threshold ("T" > " ") and the floor quietly degrades from "an
 * hour old" to "created on an earlier UTC day". A mock cannot catch that: it is
 * SQLite's own collation deciding, and only a real database has an opinion.
 */
import Database from "better-sqlite3";
import type * as SQLite from "expo-sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CREATE_TABLES_SQL } from "../schema";
import { cleanupOrphanConsumptions, cleanupOrphanTentVisits } from "../sync-queue";

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const USER = "u1";
const FESTIVAL = "f1";
const TENT = "t1";
const ATTENDANCE = "att-1";
const DATE = "2026-09-23";

/** Adapts better-sqlite3's synchronous API to the async surface the SQL needs. */
function createDb(database: Database.Database): SQLite.SQLiteDatabase {
  return {
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

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function insertTentVisit(
  database: Database.Database,
  params: { id: string; createdAt: string },
): void {
  database
    .prepare(
      `INSERT INTO tent_visits
        (id, user_id, tent_id, festival_id, visit_date, created_at, _synced_at, _deleted, _dirty)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 0, 1)`,
    )
    .run(params.id, USER, TENT, FESTIVAL, DATE, params.createdAt);
}

function insertConsumption(
  database: Database.Database,
  params: { id: string; createdAt: string },
): void {
  database
    .prepare(
      `INSERT INTO consumptions
        (id, attendance_id, drink_type, price_paid_cents, base_price_cents,
         recorded_at, created_at, updated_at, _synced_at, _deleted, _dirty)
       VALUES (?, ?, 'beer', 1550, 1550, ?, ?, ?, NULL, 0, 1)`,
    )
    .run(params.id, ATTENDANCE, params.createdAt, params.createdAt, params.createdAt);
}

function insertFailedQueueOp(
  database: Database.Database,
  params: { recordId: string; tableName: string; retryCount?: number },
): void {
  database
    .prepare(
      `INSERT INTO _sync_queue
        (id, operation, table_name, record_id, payload, status, retry_count, created_at)
       VALUES (?, 'INSERT', ?, ?, '{}', 'failed', ?, ?)`,
    )
    .run(
      `q-${params.recordId}`,
      params.tableName,
      params.recordId,
      params.retryCount ?? 3,
      hoursAgo(2),
    );
}

function rowIds(database: Database.Database, table: string): string[] {
  return database
    .prepare(`SELECT id FROM ${table} ORDER BY id`)
    .all()
    .map((row) => (row as { id: string }).id);
}

describe("orphan cleanup age floor", () => {
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
          (id, name, short_name, location, start_date, end_date, festival_type, status,
           created_at, updated_at)
         VALUES (?, ?, ?, 'Munich', '2026-09-19', '2026-10-04', 'oktoberfest', 'active',
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
      )
      .run(FESTIVAL, FESTIVAL, FESTIVAL);
    database.prepare(`INSERT INTO tents (id, name, _deleted) VALUES (?, ?, 0)`).run(TENT, TENT);
    database
      .prepare(
        `INSERT INTO attendances (id, user_id, festival_id, date, created_at, updated_at)
         VALUES (?, ?, ?, ?, '2026-09-23T00:00:00Z', '2026-09-23T00:00:00Z')`,
      )
      .run(ATTENDANCE, USER, FESTIVAL, DATE);
    db = createDb(database);
  });

  describe("cleanupOrphanTentVisits", () => {
    it("sweeps a failed visit whose ISO created_at is past the floor on the same day", async () => {
      // Two hours old, so unambiguously past a one-hour floor - but written as an
      // ISO string, which the unwrapped TEXT comparison sorted above today's
      // threshold and skipped until the UTC date rolled over.
      insertTentVisit(database, { id: "tv-old", createdAt: hoursAgo(2) });
      insertFailedQueueOp(database, { recordId: "tv-old", tableName: "tent_visits" });

      expect(await cleanupOrphanTentVisits(db)).toBe(1);
      expect(rowIds(database, "tent_visits")).toEqual([]);
      expect(rowIds(database, "_sync_queue")).toEqual([]);
    });

    it("leaves a visit that is still inside the age floor", async () => {
      insertTentVisit(database, { id: "tv-fresh", createdAt: hoursAgo(0.25) });
      insertFailedQueueOp(database, { recordId: "tv-fresh", tableName: "tent_visits" });

      expect(await cleanupOrphanTentVisits(db)).toBe(0);
      expect(rowIds(database, "tent_visits")).toEqual(["tv-fresh"]);
      expect(rowIds(database, "_sync_queue")).toEqual(["q-tv-fresh"]);
    });

    it("leaves a visit whose op has retries left", async () => {
      insertTentVisit(database, { id: "tv-retrying", createdAt: hoursAgo(2) });
      insertFailedQueueOp(database, {
        recordId: "tv-retrying",
        tableName: "tent_visits",
        retryCount: 1,
      });

      expect(await cleanupOrphanTentVisits(db)).toBe(0);
      expect(rowIds(database, "tent_visits")).toEqual(["tv-retrying"]);
    });
  });

  describe("cleanupOrphanConsumptions", () => {
    it("sweeps a failed consumption whose ISO created_at is past the floor", async () => {
      insertConsumption(database, { id: "c-old", createdAt: hoursAgo(2) });
      insertFailedQueueOp(database, { recordId: "c-old", tableName: "consumptions" });

      expect(await cleanupOrphanConsumptions(db)).toBe(1);
      expect(rowIds(database, "consumptions")).toEqual([]);
      expect(rowIds(database, "_sync_queue")).toEqual([]);
    });

    it("leaves a consumption that is still inside the age floor", async () => {
      insertConsumption(database, { id: "c-fresh", createdAt: hoursAgo(0.25) });
      insertFailedQueueOp(database, { recordId: "c-fresh", tableName: "consumptions" });

      expect(await cleanupOrphanConsumptions(db)).toBe(0);
      expect(rowIds(database, "consumptions")).toEqual(["c-fresh"]);
    });
  });
});
