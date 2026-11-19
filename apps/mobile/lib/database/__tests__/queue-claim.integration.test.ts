/**
 * Who may work on a queue op.
 *
 * The foreground sync and the background task each build their own processor,
 * and their in-memory locks do not see each other: without an atomic claim both
 * pick the same pending row and one photo uploads twice. The other direction
 * matters too: a push the OS killed mid-request leaves its op in 'processing',
 * which nothing selects, so it has to be handed back once its claim is stale.
 */
import Database from "better-sqlite3";
import type * as SQLite from "expo-sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Logger from "@/lib/logger";

import { QueueProcessor } from "../queue-processor";
import { CREATE_TABLES_SQL } from "../schema";
import { enqueueOperation, STALE_CLAIM_MS } from "../sync-queue";

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

describe("queue claims", () => {
  let database: Database.Database;
  let db: SQLite.SQLiteDatabase;

  beforeEach(() => {
    database = new Database(":memory:");
    for (const sql of Object.values(CREATE_TABLES_SQL)) {
      database.exec(sql);
    }
    db = createDb(database);
  });

  function processorCountingUploads(): { processor: QueueProcessor; uploads: () => number } {
    let uploads = 0;
    const processor = new QueueProcessor(db);
    processor.registerHandler("UPLOAD_FILE", async () => {
      uploads++;
    });
    return { processor, uploads: () => uploads };
  }

  function strandAsProcessing(opId: string, claimedAt: string | null): void {
    database
      .prepare(`UPDATE _sync_queue SET status = 'processing', claimed_at = ? WHERE id = ?`)
      .run(claimedAt, opId);
  }

  function statusOf(opId: string): string {
    return (
      database.prepare(`SELECT status FROM _sync_queue WHERE id = ?`).get(opId) as {
        status: string;
      }
    ).status;
  }

  it("uploads a photo once when two processors run at the same time", async () => {
    await enqueueOperation(db, "UPLOAD_FILE", "beer_pictures", "photo-1", { festivalId: "f1" });
    const foreground = processorCountingUploads();
    const background = processorCountingUploads();

    await Promise.all([foreground.processor.processQueue(), background.processor.processQueue()]);

    expect(foreground.uploads() + background.uploads()).toBe(1);
  });

  it("retries an op whose claim went stale", async () => {
    const opId = await enqueueOperation(db, "UPLOAD_FILE", "beer_pictures", "photo-1", {
      festivalId: "f1",
    });
    strandAsProcessing(opId, new Date(Date.now() - STALE_CLAIM_MS - 1000).toISOString());
    const { processor, uploads } = processorCountingUploads();

    await processor.processQueue();

    expect(uploads()).toBe(1);
    expect(statusOf(opId)).toBe("completed");
  });

  it("retries an op claimed before claims were timestamped", async () => {
    const opId = await enqueueOperation(db, "UPLOAD_FILE", "beer_pictures", "photo-1", {
      festivalId: "f1",
    });
    strandAsProcessing(opId, null);
    const { processor, uploads } = processorCountingUploads();

    await processor.processQueue();

    expect(uploads()).toBe(1);
  });

  it("leaves a recent claim to the processor that holds it", async () => {
    const opId = await enqueueOperation(db, "UPLOAD_FILE", "beer_pictures", "photo-1", {
      festivalId: "f1",
    });
    strandAsProcessing(opId, new Date().toISOString());
    const { processor, uploads } = processorCountingUploads();

    await processor.processQueue();

    expect(uploads()).toBe(0);
    expect(statusOf(opId)).toBe("processing");
  });
});
