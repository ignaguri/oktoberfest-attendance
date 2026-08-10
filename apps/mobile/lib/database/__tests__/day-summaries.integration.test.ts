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
  type SQLiteLike,
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

      const result = await queryTentNamesByDate(db, "f1");

      expect(result.get("2026-09-23")).toEqual(["Hofbräu"]);
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
      // ON clause. That placement matters: with it in the ON clause, the tent_visits row
      // still survives the join (with tent_name = NULL) instead of being filtered out
      // entirely. groupTentNames() then drops rows whose tent_name is null (see its
      // `if (!row.tent_name) continue;`), so in this single-row scenario the date never
      // gets a Map entry at all. The distinction matters when a day has OTHER, non-deleted
      // tent signals too: with the predicate in the ON clause those other rows still
      // surface the day; if the predicate were in WHERE instead, the entire UNION branch's
      // row would vanish, which happens to look identical here (no other rows exist) but
      // would silently swallow other tents' data in a busier day.
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
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });
      insertConsumption(database, { id: "c1", attendanceId: "a1", drinkType: null });
      insertConsumption(database, { id: "c2", attendanceId: "a1", drinkType: "beer" });

      const result = await queryDrinkCountsByDate(db, "f1");

      expect(result.get("2026-09-23")).toEqual({ beer: 2 });
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

    it("is absent from the map for a day with no photos", async () => {
      insertAttendance(database, { id: "a1", userId: "u1", festivalId: "f1", date: "2026-09-23" });

      const result = await queryPhotoCountsByDate(db, "f1");

      expect(result.has("2026-09-23")).toBe(false);
    });
  });
});
