/**
 * Which failures spend one of an operation's retries.
 *
 * An op that reaches the limit is never attempted again, and nothing revives
 * it: the pending count stays up and the photo, drink or visit never reaches
 * the server. A request that got no answer says nothing about the op itself,
 * and inside a packed tent a phone can report itself online while every
 * request drops, so those failures must not count. A rejection from the server
 * still does, or an op the server will never accept would retry forever.
 */
import Database from "better-sqlite3";
import type * as SQLite from "expo-sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Logger from "@/lib/logger";

import { QueueProcessor } from "../queue-processor";
import { CREATE_TABLES_SQL } from "../schema";
import { enqueueOperation } from "../sync-queue";

vi.mock("@/lib/logger", async (importOriginal) => ({
  ...(await importOriginal<typeof Logger>()),
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
  } as unknown as SQLite.SQLiteDatabase;
}

/** The production calls pass a single array of bind params. */
function flatten(params: unknown[]): unknown[] {
  return params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
}

describe("retries spent by a failing photo upload", () => {
  let database: Database.Database;
  let db: SQLite.SQLiteDatabase;

  beforeEach(() => {
    database = new Database(":memory:");
    for (const sql of Object.values(CREATE_TABLES_SQL)) {
      database.exec(sql);
    }
    db = createDb(database);
  });

  /** One sync's push, the way SyncManager.pushAll runs it. */
  async function pushFailingWith(message: string): Promise<void> {
    const processor = new QueueProcessor(db);
    processor.registerHandler("UPLOAD_FILE", async () => {
      throw new Error(message);
    });
    await processor.retryFailed();
  }

  function uploadOp() {
    return database
      .prepare(`SELECT status, retry_count FROM _sync_queue WHERE operation = 'UPLOAD_FILE'`)
      .get() as { status: string; retry_count: number };
  }

  it("does not spend any on requests that got no answer", async () => {
    await enqueueOperation(db, "UPLOAD_FILE", "beer_pictures", "photo-1", { festivalId: "f1" });

    for (let push = 0; push < 5; push++) {
      await pushFailingWith(
        "fetch failed: UnexpectedException: The network connection was lost. (at ExpoModulesCore/Promise.swift:56)",
      );
    }

    // Still within its budget, so the next push tries it again
    expect(uploadOp()).toEqual({ status: "failed", retry_count: 0 });
  });

  it("still spends one on each rejection from the server", async () => {
    await enqueueOperation(db, "UPLOAD_FILE", "beer_pictures", "photo-1", { festivalId: "f1" });

    for (let push = 0; push < 5; push++) {
      await pushFailingWith("Attendance not found or access denied");
    }

    expect(uploadOp()).toEqual({ status: "failed", retry_count: 3 });
  });
});
