/**
 * Runs the raw SQL in ../tent-visits against a real SQLite database.
 *
 * The reconciliation is entirely SQL: a soft-delete-aware read, a hard DELETE
 * with a generated IN list, and an INSERT OR REPLACE whose id comes from a
 * COALESCE'd subquery against a UNIQUE index. Mocking runAsync would only prove
 * "these strings were passed somewhere" — a wrong column, a missing `_deleted`
 * filter, or a unique-constraint collision would fail silently in a mock and
 * loudly on a device. So this seeds real rows into a real SQLite database built
 * from the app's own CREATE_TABLES_SQL and asserts on the real table contents.
 */
import Database from "better-sqlite3";
import type { SQLiteBindParams } from "expo-sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CREATE_TABLES_SQL } from "../schema";
import { reconcileTentVisits, type TentVisitsDb } from "../tent-visits";

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
  },
): void {
  database
    .prepare(
      `INSERT INTO tent_visits
        (id, user_id, tent_id, festival_id, visit_date, created_at, _synced_at, _deleted, _dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    )
    .run(
      params.id,
      USER,
      params.tentId,
      FESTIVAL,
      params.visitDate ?? DATE,
      params.createdAt ?? "2026-09-23T20:57:00Z",
      params.syncedAt ?? "2026-09-23T21:00:00Z",
      params.deleted ?? 0,
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
  return database
    .prepare(`SELECT * FROM tent_visits ORDER BY tent_id, visit_date`)
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

  it("revives a soft-deleted row instead of colliding with the unique index", async () => {
    // UNIQUE(user_id, tent_id, festival_id, visit_date) ignores _deleted, so a
    // plain INSERT for this tent would throw a constraint error.
    insertTentVisit(database, { id: "tv1", tentId: "t1", deleted: 1 });

    const result = await reconcile(["t1"]);

    expect(result).toEqual({ tentsAdded: ["t1"], tentsRemoved: [] });
    expect(allVisits(database)).toHaveLength(1);
    expect(allVisits(database)[0]).toMatchObject({ id: "tv1", _deleted: 0, _dirty: 1 });
  });

  it("writes one row per tent when the same tent is selected twice", async () => {
    const result = await reconcile(["t1", "t1"]);

    expect(result).toEqual({ tentsAdded: ["t1"], tentsRemoved: [] });
    expect(allVisits(database)).toHaveLength(1);
  });
});
