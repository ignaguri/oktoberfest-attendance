/**
 * Runs the raw SQL in ../consumptions against a real SQLite database.
 *
 * The sweep is entirely SQL: a predicate spanning a LEFT JOIN against
 * _sync_queue plus a DELETE with a generated IN list. Mocking runAsync would
 * only prove "these strings were passed somewhere" — a missing `_dirty` filter
 * or a join that fails to exclude a queued row would pass in a mock and delete
 * a user's drink on a device. So this seeds real rows into a real SQLite
 * database built from the app's own CREATE_TABLES_SQL and asserts on the real
 * table contents. Same approach as ./tent-visits.integration.test.ts.
 */
import Database from "better-sqlite3";
import type { SQLiteBindParams } from "expo-sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearDeletedConsumptions, type ConsumptionsDb } from "../consumptions";
import { CREATE_TABLES_SQL } from "../schema";

const USER = "u1";
const FESTIVAL = "f1";
const ATTENDANCE = "a1";
const OTHER_ATTENDANCE = "a2";
const DATE = "2026-09-23";

function createDb(database: Database.Database): ConsumptionsDb {
  return {
    getAllAsync: async <T>(sql: string, params: SQLiteBindParams) =>
      database.prepare(sql).all(...toPositionalParams(params)) as T[],
    runAsync: async (sql: string, params: SQLiteBindParams) =>
      database.prepare(sql).run(...toPositionalParams(params)),
  };
}

function toPositionalParams(params: SQLiteBindParams): unknown[] {
  return Array.isArray(params) ? params : Object.values(params);
}

function insertAttendance(database: Database.Database, id: string, date: string): void {
  database
    .prepare(
      `INSERT INTO attendances
        (id, user_id, festival_id, date, beer_count, created_at, updated_at, _synced_at, _deleted, _dirty)
       VALUES (?, ?, ?, ?, 0, '2026-09-23T10:00:00Z', '2026-09-23T10:00:00Z', '2026-09-23T10:00:00Z', 0, 0)`,
    )
    .run(id, USER, FESTIVAL, date);
}

function insertConsumption(
  database: Database.Database,
  params: {
    id: string;
    attendanceId?: string;
    syncedAt?: string | null;
    dirty?: 0 | 1;
  },
): void {
  database
    .prepare(
      `INSERT INTO consumptions
        (id, attendance_id, drink_type, price_paid_cents, base_price_cents,
         recorded_at, created_at, updated_at, _synced_at, _deleted, _dirty)
       VALUES (?, ?, 'beer', 1550, 1550, '2026-09-23T18:00:00Z',
               '2026-09-23T18:00:00Z', '2026-09-23T18:00:00Z', ?, 0, ?)`,
    )
    .run(
      params.id,
      params.attendanceId ?? ATTENDANCE,
      // `syncedAt: null` must stay distinguishable from "not supplied": it is
      // what marks a row as never having reached the server.
      params.syncedAt === undefined ? "2026-09-23T18:05:00Z" : params.syncedAt,
      params.dirty ?? 0,
    );
}

function insertQueueOp(
  database: Database.Database,
  params: { recordId: string; tableName?: string; status?: string },
): void {
  database
    .prepare(
      `INSERT INTO _sync_queue
        (id, operation, table_name, record_id, payload, status, retry_count, created_at)
       VALUES (?, 'INSERT', ?, ?, '{}', ?, 0, '2026-09-23T18:00:00Z')`,
    )
    .run(
      `q-${params.recordId}`,
      params.tableName ?? "consumptions",
      params.recordId,
      params.status ?? "pending",
    );
}

function ids(database: Database.Database, attendanceId = ATTENDANCE): string[] {
  return database
    .prepare(`SELECT id FROM consumptions WHERE attendance_id = ? ORDER BY id`)
    .all(attendanceId)
    .map((row) => (row as { id: string }).id);
}

describe("clearDeletedConsumptions", () => {
  let database: Database.Database;
  let db: ConsumptionsDb;

  beforeEach(() => {
    database = new Database(":memory:");
    for (const sql of Object.values(CREATE_TABLES_SQL)) {
      database.exec(sql);
    }
    database
      .prepare(
        `INSERT INTO festivals
          (id, name, short_name, location, start_date, end_date, festival_type, status, created_at, updated_at)
         VALUES (?, ?, ?, 'Munich', '2026-09-19', '2026-10-04', 'oktoberfest', 'active',
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
      )
      .run(FESTIVAL, FESTIVAL, FESTIVAL);
    insertAttendance(database, ATTENDANCE, DATE);
    insertAttendance(database, OTHER_ATTENDANCE, "2026-09-24");
    db = createDb(database);
  });

  afterEach(() => {
    database.close();
  });

  it("deletes a synced row the server no longer returns", async () => {
    // The bug this exists for: a drink deleted on the web stayed on the device
    // forever, inflating that day's count and spend.
    insertConsumption(database, { id: "keep" });
    insertConsumption(database, { id: "deleted-elsewhere" });

    const removed = await clearDeletedConsumptions(db, ATTENDANCE, new Set(["keep"]));

    expect(removed).toBe(1);
    expect(ids(database)).toEqual(["keep"]);
  });

  it("removes the orphan left behind when a push kept its local id", async () => {
    // Before the push carried consumptionId the server minted its own, so the
    // pull inserted the server row next to the local one and the drink counted
    // twice. The local row is clean and absent server-side, so the sweep also
    // repairs devices that already have the duplicate.
    insertConsumption(database, { id: "local-uuid" });
    insertConsumption(database, { id: "server-uuid" });

    const removed = await clearDeletedConsumptions(db, ATTENDANCE, new Set(["server-uuid"]));

    expect(removed).toBe(1);
    expect(ids(database)).toEqual(["server-uuid"]);
  });

  it("keeps a dirty row the server has not seen yet", async () => {
    // A sync pulls before it pushes, so on the cycle that first carries a new
    // drink the server legitimately does not have it. Sweeping on absence would
    // delete the drink moments after the user logged it.
    insertConsumption(database, { id: "just-logged", dirty: 1, syncedAt: null });

    const removed = await clearDeletedConsumptions(db, ATTENDANCE, new Set());

    expect(removed).toBe(0);
    expect(ids(database)).toEqual(["just-logged"]);
  });

  it("keeps a row that has never round-tripped", async () => {
    insertConsumption(database, { id: "never-synced", syncedAt: null });

    const removed = await clearDeletedConsumptions(db, ATTENDANCE, new Set());

    expect(removed).toBe(0);
    expect(ids(database)).toEqual(["never-synced"]);
  });

  it.each(["pending", "processing", "failed"])(
    "keeps a clean row whose push is still %s in the queue",
    async (status) => {
      // _dirty normally covers this, but a row whose flag was cleared while its
      // operation is still queued must not be swept from under the push.
      insertConsumption(database, { id: "queued" });
      insertQueueOp(database, { recordId: "queued", status });

      const removed = await clearDeletedConsumptions(db, ATTENDANCE, new Set());

      expect(removed).toBe(0);
      expect(ids(database)).toEqual(["queued"]);
    },
  );

  it("ignores a queue entry for a different table with the same record id", async () => {
    insertConsumption(database, { id: "shared-id" });
    insertQueueOp(database, { recordId: "shared-id", tableName: "tent_visits" });

    const removed = await clearDeletedConsumptions(db, ATTENDANCE, new Set());

    expect(removed).toBe(1);
    expect(ids(database)).toEqual([]);
  });

  it("sweeps a completed queue entry's row", async () => {
    // A finished push is not a reason to keep a row the server has dropped.
    insertConsumption(database, { id: "done" });
    insertQueueOp(database, { recordId: "done", status: "completed" });

    const removed = await clearDeletedConsumptions(db, ATTENDANCE, new Set());

    expect(removed).toBe(1);
    expect(ids(database)).toEqual([]);
  });

  it("only touches the attendance it was given", async () => {
    // The pull sweeps per day, so another day's rows are not in scope and their
    // absence from this day's response means nothing.
    insertConsumption(database, { id: "today" });
    insertConsumption(database, { id: "tomorrow", attendanceId: OTHER_ATTENDANCE });

    const removed = await clearDeletedConsumptions(db, ATTENDANCE, new Set());

    expect(removed).toBe(1);
    expect(ids(database)).toEqual([]);
    expect(ids(database, OTHER_ATTENDANCE)).toEqual(["tomorrow"]);
  });

  it("does nothing when the server set matches", async () => {
    insertConsumption(database, { id: "a" });
    insertConsumption(database, { id: "b" });

    const removed = await clearDeletedConsumptions(db, ATTENDANCE, new Set(["a", "b"]));

    expect(removed).toBe(0);
    expect(ids(database)).toEqual(["a", "b"]);
  });
});
