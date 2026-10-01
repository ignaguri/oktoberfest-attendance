/**
 * A photo queued behind a day's attendance push has to upload against the id
 * the server stored the day under.
 *
 * The attendance push sends the local id, but the server only honours it when
 * the call creates the day. When something else created the day first (the
 * quick-attendance sheet queues the tent visit ahead of the attendance, and the
 * server's tent-visit route creates the day with its own id) the push answers
 * with the existing id. Ignoring that answer left the photo pointing at an id
 * the server never had: /photos/upload-url returned 403 "Attendance not found or
 * access denied" on every retry until the op ran out of them, and the photo
 * never uploaded (PROST-COUNTER-9Q).
 *
 * Real SQLite with foreign keys on, as the app runs it during a push: the
 * beer_pictures and consumptions rows reference attendances(id), so moving the
 * day to its server id is exactly where a constraint would bite.
 */
import Database from "better-sqlite3";
import type * as SQLite from "expo-sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CREATE_TABLES_SQL } from "../schema";
import { SyncManager } from "../sync/sync-manager";
import { enqueueOperation } from "../sync-queue";

const LOCAL_ID = "local-attendance";
const SERVER_ID = "server-attendance";
const USER = "u1";
const FESTIVAL = "f1";
const DATE = "2026-10-01";
const NOW = "2026-10-01T09:03:20.000Z";

const updatePersonal = vi.fn();
vi.mock("../../api-client", () => ({
  apiClient: {
    attendance: {
      get updatePersonal() {
        return updatePersonal;
      },
    },
  },
}));

// Records which attendance the photo row points at when its upload runs, which
// is the id the real upload sends to /photos/upload-url.
const uploadedAgainst: string[] = [];
let database: Database.Database;
vi.mock("../photo-queue", () => ({
  runUploadFileOp: vi.fn(async (_db: unknown, payload: { recordId: string }) => {
    const row = database
      .prepare("SELECT attendance_id FROM beer_pictures WHERE id = ?")
      .get(payload.recordId) as { attendance_id: string };
    uploadedAgainst.push(row.attendance_id);
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Adapts better-sqlite3's synchronous API to the async surface the code uses. */
function createDb(db: Database.Database): SQLite.SQLiteDatabase {
  return {
    getFirstAsync: async (sql: string, ...params: unknown[]) =>
      db.prepare(sql).get(...flatten(params)) ?? null,
    getAllAsync: async (sql: string, ...params: unknown[]) =>
      db.prepare(sql).all(...flatten(params)),
    runAsync: async (sql: string, ...params: unknown[]) => db.prepare(sql).run(...flatten(params)),
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      db.exec("BEGIN");
      try {
        await task();
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as SQLite.SQLiteDatabase;
}

/** The production calls pass a single array of bind params. */
function flatten(params: unknown[]): unknown[] {
  return params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
}

async function seedOfflineDayWithPhoto(db: SQLite.SQLiteDatabase): Promise<void> {
  database
    .prepare(
      `INSERT INTO festivals
        (id, name, short_name, location, start_date, end_date, festival_type, status,
         created_at, updated_at)
       VALUES (?, 'Oktoberfest', 'Wiesn', 'Munich', '2026-09-19', '2026-10-04',
         'oktoberfest', 'active', ?, ?)`,
    )
    .run(FESTIVAL, NOW, NOW);
  database
    .prepare(
      `INSERT INTO attendances
        (id, user_id, festival_id, date, beer_count, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, 0, ?, ?, 1, 0)`,
    )
    .run(LOCAL_ID, USER, FESTIVAL, DATE, NOW, NOW);
  database
    .prepare(
      `INSERT INTO beer_pictures
        (id, attendance_id, user_id, created_at, _pending_upload, _local_uri)
       VALUES ('photo-1', ?, ?, ?, 1, 'file:///photo.jpg')`,
    )
    .run(LOCAL_ID, USER, NOW);

  const attendanceOpId = await enqueueOperation(db, "INSERT", "attendances", LOCAL_ID, {
    festival_id: FESTIVAL,
    date: DATE,
    beer_count: 0,
  });
  await enqueueOperation(
    db,
    "UPLOAD_FILE",
    "beer_pictures",
    "photo-1",
    { festivalId: FESTIVAL },
    { dependsOn: attendanceOpId },
  );
}

describe("pushing an attendance the server already had under another id", () => {
  let db: SQLite.SQLiteDatabase;

  beforeEach(() => {
    vi.clearAllMocks();
    uploadedAgainst.length = 0;
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    for (const sql of Object.values(CREATE_TABLES_SQL)) {
      database.exec(sql);
    }
    db = createDb(database);
  });

  it("uploads the queued photo against the server's id", async () => {
    updatePersonal.mockResolvedValue({ attendanceId: SERVER_ID, tentsAdded: [], tentsRemoved: [] });
    await seedOfflineDayWithPhoto(db);

    await new SyncManager(db).pushAll();

    expect(uploadedAgainst).toEqual([SERVER_ID]);
  });

  it("moves the day and its rows to the server's id", async () => {
    updatePersonal.mockResolvedValue({ attendanceId: SERVER_ID, tentsAdded: [], tentsRemoved: [] });
    await seedOfflineDayWithPhoto(db);

    await new SyncManager(db).pushAll();

    expect(database.prepare("SELECT id, _dirty FROM attendances").all()).toEqual([
      { id: SERVER_ID, _dirty: 0 },
    ]);
    expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("leaves everything alone when the server kept the local id", async () => {
    updatePersonal.mockResolvedValue({ attendanceId: LOCAL_ID, tentsAdded: [], tentsRemoved: [] });
    await seedOfflineDayWithPhoto(db);

    await new SyncManager(db).pushAll();

    expect(uploadedAgainst).toEqual([LOCAL_ID]);
    expect(database.prepare("SELECT id FROM attendances").all()).toEqual([{ id: LOCAL_ID }]);
  });
});
