/**
 * Runs the raw SQL in ../day-summaries against a real SQLite database.
 *
 * ../day-summaries.test.ts mocks getAllAsync, so it only proves "the function
 * calls getAllAsync with these params" — it never executes TENT_NAMES_SQL,
 * DRINK_COUNTS_SQL, or PHOTO_COUNTS_SQL. A wrong column name, a broken join,
 * or a missing soft-delete filter fails silently at runtime (an empty Map
 * that renders as "no tent data"), so this file seeds real rows into a real
 * SQLite database built from the app's own CREATE_TABLES_SQL and asserts on
 * the real returned Maps.
 */
import Database from "better-sqlite3";
import type { SQLiteBindParams } from "expo-sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  queryDrinkCountsByDate,
  queryPhotoCountsByDate,
  queryTentNamesByDate,
  type DrinkCountRow,
  type SQLiteLike,
  type TentNameRow,
} from "../day-summaries";
import { CREATE_TABLES_SQL } from "../schema";

/** Adapts better-sqlite3's synchronous API to the async SQLiteLike interface. */
function createDb(database: Database.Database): SQLiteLike {
  return {
    getAllAsync: async <T>(sql: string, params: SQLiteBindParams) =>
      database.prepare(sql).all(...toPositionalParams(params)) as T[],
  };
}

/**
 * SQLiteBindParams is `Record<string, SQLiteBindValue> | SQLiteBindValue[]`, but
 * better-sqlite3's `.all()` takes a spreadable positional argument list. Every
 * call site in day-summaries.ts passes an array, but this normalizes the named-params
 * case too rather than assuming that.
 */
function toPositionalParams(params: SQLiteBindParams): unknown[] {
  return Array.isArray(params) ? params : Object.values(params);
}

/**
 * Wraps createDb() to record the exact SQL string and params each getAllAsync call was
 * given. This lets a test re-run the *shipped* query constant directly (via
 * `db.getAllAsync(calls[0].sql, calls[0].params)`) and assert on the raw row set, before
 * groupTentNames/groupDrinkCounts/groupPhotoCounts do any JS-side deduplication or summing
 * that could mask a SQL-level regression (e.g. UNION -> UNION ALL, or a GROUP BY that loses
 * a COALESCE the SELECT list still has).
 */
function createSpyDb(database: Database.Database): {
  db: SQLiteLike;
  calls: { sql: string; params: SQLiteBindParams }[];
} {
  const plainDb = createDb(database);
  const calls: { sql: string; params: SQLiteBindParams }[] = [];
  const db: SQLiteLike = {
    getAllAsync: async <T>(sql: string, params: SQLiteBindParams) => {
      calls.push({ sql, params });
      return plainDb.getAllAsync<T>(sql, params);
    },
  };
  return { db, calls };
}

/**
 * attendances.festival_id and tent_visits.festival_id are FK-constrained, and the app
 * turns PRAGMA foreign_keys ON at init (see lib/database/init.ts), so every festival_id
 * used below needs a real row here — otherwise inserts fail with a constraint error that
 * has nothing to do with the day-summaries queries under test.
 */
function insertFestival(database: Database.Database, id: string): void {
  database
    .prepare(
      `INSERT INTO festivals
        (id, name, short_name, location, start_date, end_date, festival_type, status, created_at, updated_at)
       VALUES (?, ?, ?, 'Munich', '2026-09-19', '2026-10-04', 'oktoberfest', 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    )
    .run(id, id, id);
}

function insertTent(
  database: Database.Database,
  params: { id: string; name: string; deleted?: 0 | 1 },
): void {
  database
    .prepare(`INSERT INTO tents (id, name, _deleted) VALUES (?, ?, ?)`)
    .run(params.id, params.name, params.deleted ?? 0);
}

function insertAttendance(
  database: Database.Database,
  params: { id: string; userId: string; festivalId: string; date: string; deleted?: 0 | 1 },
): void {
  database
    .prepare(
      `INSERT INTO attendances (id, user_id, festival_id, date, created_at, updated_at, _deleted)
       VALUES (?, ?, ?, ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?)`,
    )
    .run(params.id, params.userId, params.festivalId, params.date, params.deleted ?? 0);
}

function insertTentVisit(
  database: Database.Database,
  params: {
    id: string;
    userId: string;
    tentId: string;
    festivalId: string;
    visitDate: string;
    deleted?: 0 | 1;
  },
): void {
  database
    .prepare(
      `INSERT INTO tent_visits (id, user_id, tent_id, festival_id, visit_date, _deleted)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(params.id, params.userId, params.tentId, params.festivalId, params.visitDate, params.deleted ?? 0);
}

function insertConsumption(
  database: Database.Database,
  params: {
    id: string;
    attendanceId: string;
    tentId?: string | null;
    /** Pass `null` explicitly to write a real NULL; omit to take the "beer" column default. */
    drinkType?: string | null;
    deleted?: 0 | 1;
  },
): void {
  database
    .prepare(
      `INSERT INTO consumptions
        (id, attendance_id, drink_type, price_paid_cents, base_price_cents, tent_id, recorded_at, created_at, updated_at, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?)`,
    )
    .run(
      params.id,
      params.attendanceId,
      params.drinkType === undefined ? "beer" : params.drinkType,
      500,
      500,
      params.tentId ?? null,
      params.deleted ?? 0,
    );
}

function insertBeerPicture(
  database: Database.Database,
  params: { id: string; attendanceId: string; userId: string; deleted?: 0 | 1 },
): void {
  database
    .prepare(
      `INSERT INTO beer_pictures (id, attendance_id, user_id, created_at, _deleted)
       VALUES (?, ?, ?, '2026-01-01T00:00:00Z', ?)`,
    )
    .run(params.id, params.attendanceId, params.userId, params.deleted ?? 0);
}

describe("day-summaries SQL against real SQLite", () => {
  let database: Database.Database;
  let db: SQLiteLike;

  beforeEach(() => {
    // Fresh in-memory database per test so no test can leak state into another.
    database = new Database(":memory:");
    // Build the schema from the app's own DDL, not hand-written CREATE TABLEs — this is
    // what makes the test fail if the real DDL and the real SQL in day-summaries.ts ever
    // disagree. Running every value also proves CREATE_TABLES_SQL is internally coherent
    // (no table references a column/table that doesn't exist).
    for (const createTableSql of Object.values(CREATE_TABLES_SQL)) {
      database.exec(createTableSql);
    }
    // attendances.festival_id and tent_visits.festival_id are FK-constrained, and the app
    // turns PRAGMA foreign_keys ON at init (see lib/database/init.ts). Every test below
    // uses only "f1" or "f2" as a festival id, so both are seeded once here.
    insertFestival(database, "f1");
    insertFestival(database, "f2");
    db = createDb(database);
  });

  afterEach(() => {
    database.close();
  });

  describe("queryTentNamesByDate", () => {
    it("deduplicates a tent that appears via both tent_visits and consumptions (proves UNION, not UNION ALL)", async () => {
      const { db: spyDb, calls } = createSpyDb(database);
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertTent(database, { id: "t1", name: "Hofbräu" });
      insertTentVisit(database, {
        id: "tv1",
        userId: "u1",
        tentId: "t1",
        festivalId: "f1",
        visitDate: "2026-09-23",
      });
      insertConsumption(database, { id: "c1", attendanceId: "a1", tentId: "t1" });

      const result = await queryTentNamesByDate(spyDb, "f1");

      expect(result.get("2026-09-23")).toEqual(["Hofbräu"]);

      // groupTentNames() already de-duplicates identical tent names per date in JS, so the
      // assertion above alone would still pass byte-for-byte under UNION ALL (two
      // "Hofbräu" rows collapsed to one by the JS grouping). Re-running the exact SQL and
      // params queryTentNamesByDate issued proves the dedup happens in SQLite itself:
      // UNION returns 1 raw row here; UNION ALL would return 2.
      const rawRows = await spyDb.getAllAsync<TentNameRow>(calls[0].sql, calls[0].params);
      expect(rawRows).toHaveLength(1);
    });

    it("keeps a tent visit's name when there is no consumption at that tent (the reason the UNION exists)", async () => {
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertTent(database, { id: "t1", name: "Hofbräu" });
      insertTentVisit(database, {
        id: "tv1",
        userId: "u1",
        tentId: "t1",
        festivalId: "f1",
        visitDate: "2026-09-23",
      });
      // Deliberately no consumption row — production seed data doesn't contain this case.

      const result = await queryTentNamesByDate(db, "f1");

      expect(result.get("2026-09-23")).toEqual(["Hofbräu"]);
    });

    it("keeps a consumption's tent when there is no matching tent_visits row", async () => {
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertTent(database, { id: "t1", name: "Hofbräu" });
      insertConsumption(database, { id: "c1", attendanceId: "a1", tentId: "t1" });
      // Deliberately no tent_visits row.

      const result = await queryTentNamesByDate(db, "f1");

      expect(result.get("2026-09-23")).toEqual(["Hofbräu"]);
    });

    it("excludes a tent from a soft-deleted tent_visits row", async () => {
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertTent(database, { id: "t1", name: "Hofbräu" });
      insertTentVisit(database, {
        id: "tv1",
        userId: "u1",
        tentId: "t1",
        festivalId: "f1",
        visitDate: "2026-09-23",
        deleted: 1,
      });

      const result = await queryTentNamesByDate(db, "f1");

      expect(result.has("2026-09-23")).toBe(false);
    });

    it("excludes a tent from a soft-deleted consumption row", async () => {
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertTent(database, { id: "t1", name: "Hofbräu" });
      insertConsumption(database, { id: "c1", attendanceId: "a1", tentId: "t1", deleted: 1 });

      const result = await queryTentNamesByDate(db, "f1");

      expect(result.has("2026-09-23")).toBe(false);
    });

    it("excludes an entire day when the attendance row is soft-deleted", async () => {
      insertAttendance(database, {
        id: "a1",
        userId: "u1",
        festivalId: "f1",
        date: "2026-09-23",
        deleted: 1,
      });
      insertTent(database, { id: "t1", name: "Hofbräu" });
      insertTentVisit(database, {
        id: "tv1",
        userId: "u1",
        tentId: "t1",
        festivalId: "f1",
        visitDate: "2026-09-23",
      });
      insertConsumption(database, { id: "c1", attendanceId: "a1", tentId: "t1" });

      const result = await queryTentNamesByDate(db, "f1");

      expect(result.has("2026-09-23")).toBe(false);
    });

    it("drops the tent name (without dropping the day) when the tent itself is soft-deleted", async () => {
      // Commit 92dbce7f moved `t._deleted = 0` from the WHERE clause into the LEFT JOIN's
      // ON clause. This test proves the actual bug that guards against: with NO
      // `t._deleted` check at all, a soft-deleted tent's name would leak into the result.
      // It does NOT prove ON is a better placement than WHERE for this predicate — verified
      // directly (outside this suite) that both placements produce identical output through
      // queryTentNamesByDate, because groupTentNames() drops null-name rows either way,
      // normalizing the difference away before it's observable here. ON is preferred for
      // intent and robustness (a soft-deleted tent shouldn't risk swallowing a whole UNION
      // branch's row if the WHERE clause predicate were ever combined with an AND that
      // touches other columns), but that preference isn't something this function's return
      // value can distinguish.
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertTent(database, { id: "t1", name: "Hofbräu", deleted: 1 });
      insertTentVisit(database, {
        id: "tv1",
        userId: "u1",
        tentId: "t1",
        festivalId: "f1",
        visitDate: "2026-09-23",
      });

      const result = await queryTentNamesByDate(db, "f1");

      expect(result.has("2026-09-23")).toBe(false);
    });

    it("joins when visit_date is a bare date string matching attendances.date", async () => {
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertTent(database, { id: "t1", name: "Hofbräu" });
      insertTentVisit(database, {
        id: "tv1",
        userId: "u1",
        tentId: "t1",
        festivalId: "f1",
        visitDate: "2026-09-23",
      });

      const result = await queryTentNamesByDate(db, "f1");

      expect(result.get("2026-09-23")).toEqual(["Hofbräu"]);
    });

    it("does NOT join when visit_date is a full timestamp for the same calendar day", async () => {
      // This documents the local-only normalization invariant: the sync layer writes
      // visit_date as a bare YYYY-MM-DD string (see lib/database/sync/pull-user-data.ts),
      // which is what makes the plain string equality `a.date = tv.visit_date` correct.
      // Postgres could not validate this invariant (visit_date is timestamptz there and
      // needed a ::date cast). If the local normalization ever regresses and a full
      // timestamp leaks into visit_date, this is the failure mode: the tent silently
      // disappears from the day list instead of erroring.
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertTent(database, { id: "t1", name: "Hofbräu" });
      insertTentVisit(database, {
        id: "tv1",
        userId: "u1",
        tentId: "t1",
        festivalId: "f1",
        visitDate: "2026-09-23T12:00:00Z",
      });

      const result = await queryTentNamesByDate(db, "f1");

      expect(result.has("2026-09-23")).toBe(false);
    });

    it("excludes rows belonging to a different festival", async () => {
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertAttendance(database, { id: "a2", userId: "u1", festivalId: "f2", date: "2026-09-24" });
      insertTent(database, { id: "t1", name: "Hofbräu" });
      insertTent(database, { id: "t2", name: "Schottenhamel" });
      insertTentVisit(database, {
        id: "tv1",
        userId: "u1",
        tentId: "t1",
        festivalId: "f1",
        visitDate: "2026-09-23",
      });
      insertTentVisit(database, {
        id: "tv2",
        userId: "u1",
        tentId: "t2",
        festivalId: "f2",
        visitDate: "2026-09-24",
      });

      const result = await queryTentNamesByDate(db, "f1");

      expect(result.get("2026-09-23")).toEqual(["Hofbräu"]);
      expect(result.has("2026-09-24")).toBe(false);
    });
  });

  describe("queryDrinkCountsByDate", () => {
    it("groups multiple drink types per day", async () => {
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertConsumption(database, { id: "c1", attendanceId: "a1", drinkType: "beer" });
      insertConsumption(database, { id: "c2", attendanceId: "a1", drinkType: "beer" });
      insertConsumption(database, { id: "c3", attendanceId: "a1", drinkType: "radler" });

      const result = await queryDrinkCountsByDate(db, "f1");

      expect(result.get("2026-09-23")).toEqual({ beer: 2, radler: 1 });
    });

    it("counts an explicit NULL drink_type as beer (proves COALESCE in the SELECT list and GROUP BY)", async () => {
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      // drinkType: null is written explicitly. Omitting the column would take the "beer"
      // column default and never exercise the COALESCE at all.
      insertConsumption(database, { id: "c1", attendanceId: "a1", drinkType: null });

      const result = await queryDrinkCountsByDate(db, "f1");

      expect(result.get("2026-09-23")).toEqual({ beer: 1 });
    });

    it("sums a NULL-type row and a real beer row into a single beer entry, not two", async () => {
      const { db: spyDb, calls } = createSpyDb(database);
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertConsumption(database, { id: "c1", attendanceId: "a1", drinkType: null });
      insertConsumption(database, { id: "c2", attendanceId: "a1", drinkType: "beer" });

      const result = await queryDrinkCountsByDate(spyDb, "f1");

      expect(result.get("2026-09-23")).toEqual({ beer: 2 });

      // groupDrinkCounts() sums counts per computed key in JS, so the assertion above alone
      // would still pass if GROUP BY used the raw (uncoalesced) c.drink_type while only the
      // SELECT list applied COALESCE: that would produce two raw rows — one for the NULL
      // group, one for the 'beer' group — each labelled "beer" after the SELECT-list
      // COALESCE, and JS would sum them to the same { beer: 2 }. Re-running the shipped SQL
      // directly proves the GROUP BY itself coalesces: exactly one raw row for "beer".
      const rawRows = await spyDb.getAllAsync<DrinkCountRow>(calls[0].sql, calls[0].params);
      expect(rawRows).toHaveLength(1);
      expect(rawRows[0]).toEqual({ date: "2026-09-23", drink_type: "beer", count: 2 });
    });

    it("produces no entry for an attendance with zero consumptions", async () => {
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });

      const result = await queryDrinkCountsByDate(db, "f1");

      expect(result.has("2026-09-23")).toBe(false);
    });

    it("excludes a soft-deleted consumption", async () => {
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertConsumption(database, { id: "c1", attendanceId: "a1", drinkType: "beer", deleted: 1 });

      const result = await queryDrinkCountsByDate(db, "f1");

      expect(result.has("2026-09-23")).toBe(false);
    });

    it("excludes consumptions under a soft-deleted attendance", async () => {
      insertAttendance(database, {
        id: "a1",
        userId: "u1",
        festivalId: "f1",
        date: "2026-09-23",
        deleted: 1,
      });
      insertConsumption(database, { id: "c1", attendanceId: "a1", drinkType: "beer" });

      const result = await queryDrinkCountsByDate(db, "f1");

      expect(result.has("2026-09-23")).toBe(false);
    });
  });

  describe("queryPhotoCountsByDate", () => {
    it("counts photos per day", async () => {
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertBeerPicture(database, { id: "bp1", attendanceId: "a1", userId: "u1" });
      insertBeerPicture(database, { id: "bp2", attendanceId: "a1", userId: "u1" });

      const result = await queryPhotoCountsByDate(db, "f1");

      expect(result.get("2026-09-23")).toBe(2);
    });

    it("excludes a soft-deleted photo", async () => {
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertBeerPicture(database, { id: "bp1", attendanceId: "a1", userId: "u1", deleted: 1 });

      const result = await queryPhotoCountsByDate(db, "f1");

      expect(result.has("2026-09-23")).toBe(false);
    });

    it("excludes photos under a soft-deleted attendance", async () => {
      insertAttendance(database, {
        id: "a1",
        userId: "u1",
        festivalId: "f1",
        date: "2026-09-23",
        deleted: 1,
      });
      insertBeerPicture(database, { id: "bp1", attendanceId: "a1", userId: "u1" });

      const result = await queryPhotoCountsByDate(db, "f1");

      expect(result.has("2026-09-23")).toBe(false);
    });

    it("is absent from the map for a day with no photos", async () => {
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });

      const result = await queryPhotoCountsByDate(db, "f1");

      expect(result.has("2026-09-23")).toBe(false);
    });
  });
});
