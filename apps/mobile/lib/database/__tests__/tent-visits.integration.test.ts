/**
 * Runs the raw SQL in ../tent-visits against a real SQLite database.
 *
 * Both operations are entirely SQL: a soft-delete-aware read, hard DELETEs with
 * generated IN lists, a revive-or-insert pair, and a delete whose predicate spans
 * a subquery against _sync_queue. Mocking runAsync would only prove "these
 * strings were passed somewhere" — a wrong column, a missing `_deleted` filter,
 * or a predicate that catches one row too many would fail silently in a mock and
 * loudly on a device. So this seeds real rows into a real SQLite database built
 * from the app's own CREATE_TABLES_SQL and asserts on the real table contents.
 */
import Database from "better-sqlite3";
import type { SQLiteBindParams } from "expo-sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CREATE_TABLES_SQL } from "../schema";
import {
  clearSupersededTentVisits,
  reconcileTentVisits,
  type TentVisitsDb,
} from "../tent-visits";

const USER = "u1";
const FESTIVAL = "f1";
const DATE = "2026-09-23";

/** Adapts better-sqlite3's synchronous API to the async TentVisitsDb interface. */
function createDb(database: Database.Database): TentVisitsDb {
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

function insertFestival(database: Database.Database, id: string): void {
  database
    .prepare(
      `INSERT INTO festivals
        (id, name, short_name, location, start_date, end_date, festival_type, status, created_at, updated_at)
       VALUES (?, ?, ?, 'Munich', '2026-09-19', '2026-10-04', 'oktoberfest', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    )
    .run(id, id, id);
}

function insertTent(database: Database.Database, id: string): void {
  database.prepare(`INSERT INTO tents (id, name, _deleted) VALUES (?, ?, 0)`).run(id, id);
}

function insertTentVisit(
  database: Database.Database,
  params: {
    id: string;
    tentId: string;
    visitDate?: string;
    createdAt?: string;
    syncedAt?: string | null;
    deleted?: 0 | 1;
    dirty?: 0 | 1;
  },
): void {
  database
    .prepare(
      `INSERT INTO tent_visits
        (id, user_id, tent_id, festival_id, visit_date, created_at, _synced_at, _deleted, _dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.id,
      USER,
      params.tentId,
      FESTIVAL,
      params.visitDate ?? DATE,
      params.createdAt ?? "2026-09-23T20:57:00Z",
      // `syncedAt: null` has to stay distinguishable from "not supplied", since it
      // is what marks a row as never having reached the server.
      params.syncedAt === undefined ? "2026-09-23T21:00:00Z" : params.syncedAt,
      params.deleted ?? 0,
      params.dirty ?? 0,
    );
}

/** Queues a sync operation, which is what marks a local row as awaiting push. */
function insertQueueOp(
  database: Database.Database,
  params: { recordId: string; tableName?: string; status?: string },
): void {
  database
    .prepare(
      `INSERT INTO _sync_queue
        (id, operation, table_name, record_id, payload, status, retry_count, created_at)
       VALUES (?, 'INSERT', ?, ?, '{}', ?, 0, '2026-09-23T20:57:00Z')`,
    )
    .run(
      `q-${params.recordId}`,
      params.tableName ?? "tent_visits",
      params.recordId,
      params.status ?? "pending",
    );
}

interface VisitRow {
  id: string;
  tent_id: string;
  visit_date: string | null;
  created_at: string | null;
  _synced_at: string | null;
  _deleted: number;
  _dirty: number;
}

function allVisits(database: Database.Database): VisitRow[] {
  // created_at breaks the tie between two visits to the same tent on one day,
  // which the table now allows (migration v2 -> v3).
  return database
    .prepare(`SELECT * FROM tent_visits ORDER BY tent_id, visit_date, created_at`)
    .all() as VisitRow[];
}

describe("reconcileTentVisits against real SQLite", () => {
  let database: Database.Database;
  let db: TentVisitsDb;
  let generatedIds: string[];

  function reconcile(tentIds: string[], date = DATE) {
    return reconcileTentVisits(db, {
      userId: USER,
      festivalId: FESTIVAL,
      date,
      tentIds,
      now: "2026-09-24T10:00:00Z",
      generateId: () => {
        const id = `new-${generatedIds.length + 1}`;
        generatedIds.push(id);
        return id;
      },
    });
  }

  beforeEach(() => {
    // Fresh in-memory database per test so no test can leak state into another.
    database = new Database(":memory:");
    // Build the schema from the app's own DDL, not hand-written CREATE TABLEs, so
    // this fails if the real DDL and the real SQL in tent-visits.ts ever disagree.
    for (const createTableSql of Object.values(CREATE_TABLES_SQL)) {
      database.exec(createTableSql);
    }
    // tent_visits.tent_id and .festival_id are FK-constrained and the app turns
    // foreign_keys ON at init (see lib/database/init.ts), so enforce them here too.
    database.pragma("foreign_keys = ON");
    insertFestival(database, FESTIVAL);
    insertTent(database, "t1");
    insertTent(database, "t2");
    generatedIds = [];
    db = createDb(database);
  });

  afterEach(() => {
    database.close();
  });

  it("deletes a deselected tent's visit and reports it as removed", async () => {
    insertTentVisit(database, { id: "tv1", tentId: "t1" });
    insertTentVisit(database, { id: "tv2", tentId: "t2" });

    const result = await reconcile(["t1"]);

    expect(result).toEqual({ tentsAdded: [], tentsRemoved: ["t2"] });
    // A hard delete, not a tombstone: nothing pushes tent_visits deletions, so a
    // `_deleted = 1` row would linger locally and never reach the server.
    expect(allVisits(database).map((row) => row.tent_id)).toEqual(["t1"]);
  });

  it("clears every visit for the day when given an empty selection", async () => {
    insertTentVisit(database, { id: "tv1", tentId: "t1" });
    insertTentVisit(database, { id: "tv2", tentId: "t2" });

    const result = await reconcile([]);

    expect(result).toEqual({ tentsAdded: [], tentsRemoved: ["t1", "t2"] });
    expect(allVisits(database)).toEqual([]);
  });

  it("leaves other days alone when clearing one day", async () => {
    insertTentVisit(database, { id: "tv1", tentId: "t1" });
    insertTentVisit(database, { id: "tv2", tentId: "t1", visitDate: "2026-09-24" });

    const result = await reconcile([]);

    expect(result.tentsRemoved).toEqual(["t1"]);
    expect(allVisits(database).map((row) => row.visit_date)).toEqual(["2026-09-24"]);
  });

  it("keeps an already-visited tent's row byte-for-byte and only inserts the new one", async () => {
    insertTentVisit(database, { id: "tv1", tentId: "t1" });

    const result = await reconcile(["t1", "t2"]);

    expect(result).toEqual({ tentsAdded: ["t2"], tentsRemoved: [] });
    // Rewriting the existing row would reset created_at to `now` and lose the
    // real visit time the day sheet renders next to the tent name.
    const [kept, inserted] = allVisits(database);
    expect(kept).toMatchObject({
      id: "tv1",
      created_at: "2026-09-23T20:57:00Z",
      _synced_at: "2026-09-23T21:00:00Z",
      _dirty: 0,
    });
    expect(inserted).toMatchObject({
      id: "new-1",
      tent_id: "t2",
      created_at: "2026-09-24T10:00:00Z",
      _synced_at: null,
      _dirty: 1,
      _deleted: 0,
    });
  });

  it("revives a soft-deleted row rather than adding a second one beside it", async () => {
    insertTentVisit(database, { id: "tv1", tentId: "t1", deleted: 1 });

    const result = await reconcile(["t1"]);

    expect(result).toEqual({ tentsAdded: ["t1"], tentsRemoved: [] });
    // Nothing forces this now the unique index is gone (migration v2 -> v3), but
    // reusing the id keeps the pull's per-day matching on one row instead of a
    // live row plus a tombstone sharing its natural key.
    expect(allVisits(database)).toHaveLength(1);
    expect(allVisits(database)[0]).toMatchObject({ id: "tv1", _deleted: 0, _dirty: 1 });
  });

  it("writes one row per tent when the same tent is selected twice", async () => {
    const result = await reconcile(["t1", "t1"]);

    expect(result).toEqual({ tentsAdded: ["t1"], tentsRemoved: [] });
    expect(allVisits(database)).toHaveLength(1);
  });

  // The reconcile is a set operation over which tents the day holds, so it must
  // stay blind to how many times each was visited: a revisit logged separately
  // is not its business to add, remove, or collapse.
  it("leaves a second visit to the same tent untouched", async () => {
    insertTentVisit(database, { id: "tv1", tentId: "t1" });
    insertTentVisit(database, { id: "tv2", tentId: "t2" });
    insertTentVisit(database, {
      id: "tv3",
      tentId: "t1",
      createdAt: "2026-09-23T22:30:00Z",
    });

    const result = await reconcile(["t1", "t2"]);

    expect(result).toEqual({ tentsAdded: [], tentsRemoved: [] });
    expect(allVisits(database).map((row) => row.id)).toEqual(["tv1", "tv3", "tv2"]);
  });

  it("removes every visit to a deselected tent, not just the first", async () => {
    insertTentVisit(database, { id: "tv1", tentId: "t1" });
    insertTentVisit(database, { id: "tv2", tentId: "t2" });
    insertTentVisit(database, {
      id: "tv3",
      tentId: "t1",
      createdAt: "2026-09-23T22:30:00Z",
    });

    const result = await reconcile(["t2"]);

    expect(result).toEqual({ tentsAdded: [], tentsRemoved: ["t1"] });
    expect(allVisits(database).map((row) => row.id)).toEqual(["tv2"]);
  });
});

describe("clearSupersededTentVisits against real SQLite", () => {
  let database: Database.Database;
  let db: TentVisitsDb;

  beforeEach(() => {
    database = new Database(":memory:");
    for (const createTableSql of Object.values(CREATE_TABLES_SQL)) {
      database.exec(createTableSql);
    }
    database.pragma("foreign_keys = ON");
    insertFestival(database, FESTIVAL);
    insertTent(database, "t1");
    insertTent(database, "t2");
    db = createDb(database);
  });

  afterEach(() => {
    database.close();
  });

  function clear(serverIds: string[], tentId = "t1") {
    return clearSupersededTentVisits(db, {
      userId: USER,
      tentId,
      festivalId: FESTIVAL,
      visitDate: DATE,
      serverIds,
    });
  }

  it("deletes a ghost left behind by the attendance push", async () => {
    // The client wrote this row itself and the server materialized the visit
    // under an id of its own, so nothing will ever push or claim the local one.
    insertTentVisit(database, { id: "ghost", tentId: "t1", syncedAt: null, dirty: 1 });
    insertTentVisit(database, { id: "server-1", tentId: "t1" });

    expect(await clear(["server-1"])).toBe(1);
    expect(allVisits(database).map((row) => row.id)).toEqual(["server-1"]);
  });

  // The regression this whole function exists for: with a unique index gone, two
  // visits to one tent on one day are both legitimate server rows.
  it("keeps every server row in the group", async () => {
    insertTentVisit(database, { id: "server-1", tentId: "t1", createdAt: "2026-09-23T10:00:00Z" });
    insertTentVisit(database, { id: "server-2", tentId: "t1", createdAt: "2026-09-23T20:00:00Z" });

    expect(await clear(["server-1", "server-2"])).toBe(0);
    expect(allVisits(database).map((row) => row.id)).toEqual(["server-1", "server-2"]);
  });

  it("keeps an unsynced visit that is still queued to push", async () => {
    insertTentVisit(database, { id: "server-1", tentId: "t1", createdAt: "2026-09-23T10:00:00Z" });
    insertTentVisit(database, {
      id: "pending",
      tentId: "t1",
      createdAt: "2026-09-23T20:00:00Z",
      syncedAt: null,
      dirty: 1,
    });
    insertQueueOp(database, { recordId: "pending" });

    // Deleting this would lose a revisit the user logged offline, before the
    // push that would have made it a server row ever ran.
    expect(await clear(["server-1"])).toBe(0);
    expect(allVisits(database).map((row) => row.id)).toEqual(["server-1", "pending"]);
  });

  it("deletes an unsynced visit whose queued push has already completed", async () => {
    insertTentVisit(database, { id: "server-1", tentId: "t1" });
    insertTentVisit(database, { id: "drained", tentId: "t1", syncedAt: null, dirty: 1 });
    insertQueueOp(database, { recordId: "drained", status: "completed" });

    expect(await clear(["server-1"])).toBe(1);
    expect(allVisits(database).map((row) => row.id)).toEqual(["server-1"]);
  });

  it("ignores a queued operation for a different table", async () => {
    insertTentVisit(database, { id: "server-1", tentId: "t1" });
    insertTentVisit(database, { id: "ghost", tentId: "t1", syncedAt: null, dirty: 1 });
    insertQueueOp(database, { recordId: "ghost", tableName: "attendances" });

    expect(await clear(["server-1"])).toBe(1);
    expect(allVisits(database).map((row) => row.id)).toEqual(["server-1"]);
  });

  it("deletes a legacy row whose visit_date is a timestamp the server dropped", async () => {
    // Pulled before visit_date was normalized to the day, so no UI query can see
    // it, and the server no longer lists its id.
    insertTentVisit(database, { id: "legacy", tentId: "t1", visitDate: `${DATE}T18:00:00Z` });
    insertTentVisit(database, { id: "server-1", tentId: "t1" });

    expect(await clear(["server-1"])).toBe(1);
    expect(allVisits(database).map((row) => row.id)).toEqual(["server-1"]);
  });

  it("keeps a timestamp-format row the server still returns", async () => {
    // The caller's upsert rewrites this row's visit_date, so deleting it here
    // would drop a visit the server is actively reporting.
    insertTentVisit(database, { id: "server-1", tentId: "t1", visitDate: `${DATE}T18:00:00Z` });

    expect(await clear(["server-1"])).toBe(0);
    expect(allVisits(database).map((row) => row.id)).toEqual(["server-1"]);
  });

  it("leaves other tents and other days alone", async () => {
    insertTentVisit(database, { id: "server-1", tentId: "t1" });
    insertTentVisit(database, { id: "other-tent", tentId: "t2", syncedAt: null, dirty: 1 });
    insertTentVisit(database, {
      id: "other-day",
      tentId: "t1",
      visitDate: "2026-09-24",
      syncedAt: null,
      dirty: 1,
    });

    expect(await clear(["server-1"])).toBe(0);
    expect(allVisits(database).map((row) => row.id).sort()).toEqual([
      "other-day",
      "other-tent",
      "server-1",
    ]);
  });
});
