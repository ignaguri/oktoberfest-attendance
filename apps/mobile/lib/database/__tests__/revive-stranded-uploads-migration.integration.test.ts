/**
 * Photos stranded by the attendance id mismatch get one more go.
 *
 * Before the push adopted the server's id for a day, a photo queued behind a
 * day the server already had uploaded against an id it never stored, got 403
 * "Attendance not found or access denied" and ran out of retries. The next pull
 * moved the photo to the right day, but nothing attempts an op past its retry
 * limit again, so those photos never upload. The v5 migration gives them a
 * fresh budget once; every other failed op is left as it is.
 */
import Database from "better-sqlite3";
import type * as SQLite from "expo-sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runMigrations } from "../migrations";
import { CREATE_TABLES_SQL, SCHEMA_VERSION } from "../schema";

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const ATTENDANCE_403 = "Attendance not found or access denied";

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

function insertOp(
  database: Database.Database,
  op: { id: string; operation: string; status: string; retryCount: number; lastError: string | null },
): void {
  database
    .prepare(
      `INSERT INTO _sync_queue (id, operation, table_name, record_id, payload, status, retry_count, last_error, created_at)
       VALUES (?, ?, 'beer_pictures', ?, '{}', ?, ?, ?, '2026-09-30T16:10:22.000Z')`,
    )
    .run(op.id, op.operation, `record-${op.id}`, op.status, op.retryCount, op.lastError);
}

function op(database: Database.Database, id: string) {
  return database.prepare(`SELECT status, retry_count FROM _sync_queue WHERE id = ?`).get(id);
}

describe("v4 -> v5: revive uploads stranded by the attendance id mismatch", () => {
  let database: Database.Database;

  beforeEach(() => {
    database = new Database(":memory:");
    for (const sql of Object.values(CREATE_TABLES_SQL)) {
      database.exec(sql);
    }
    database.pragma("user_version = 4");
  });

  it("gives a stranded photo a fresh retry budget", async () => {
    insertOp(database, {
      id: "stranded",
      operation: "UPLOAD_FILE",
      status: "failed",
      retryCount: 3,
      lastError: ATTENDANCE_403,
    });

    await runMigrations(createDb(database));

    expect(op(database, "stranded")).toEqual({ status: "pending", retry_count: 0 });
    expect(database.pragma("user_version", { simple: true })).toBe(SCHEMA_VERSION);
  });

  it("leaves every other failed op alone", async () => {
    insertOp(database, {
      id: "other-upload-error",
      operation: "UPLOAD_FILE",
      status: "failed",
      retryCount: 3,
      lastError: "Upload failed: 413",
    });
    insertOp(database, {
      id: "other-op-type",
      operation: "INSERT",
      status: "failed",
      retryCount: 3,
      lastError: ATTENDANCE_403,
    });

    await runMigrations(createDb(database));

    expect(op(database, "other-upload-error")).toEqual({ status: "failed", retry_count: 3 });
    expect(op(database, "other-op-type")).toEqual({ status: "failed", retry_count: 3 });
  });
});
