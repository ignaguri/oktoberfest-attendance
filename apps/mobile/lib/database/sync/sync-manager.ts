/**
 * Sync Manager
 *
 * Lean orchestrator that coordinates pull and push sync operations.
 * Domain logic lives in the pull-* and push-* modules.
 */

import type * as SQLite from "expo-sqlite";

import { logger } from "@/lib/logger";

import { type ProcessorResult, QueueProcessor } from "../queue-processor";
import { MUTABLE_TABLES } from "../schema";
import { getQueueStats, getSyncMetadata } from "../sync-queue";
import {
  pullGroupMembers,
  pullGroups,
  pullUserAchievements,
} from "./pull-groups";
import { pullAchievements, pullFestivals, pullTents } from "./pull-reference";
import {
  pullAttendances,
  pullConsumptions,
  pullProfile,
} from "./pull-user-data";
import { pushDelete, pushInsert, pushUpdate } from "./push-handlers";
import type { PullResult, SyncOptions, SyncResult } from "./types";

// Re-export types for consumers
export type {
  PullResult,
  SyncDirection,
  SyncOptions,
  SyncResult,
} from "./types";

export class SyncManager {
  private db: SQLite.SQLiteDatabase;
  private isSyncing = false;
  private abortController: AbortController | null = null;

  constructor(db: SQLite.SQLiteDatabase) {
    this.db = db;
  }

  get syncing(): boolean {
    return this.isSyncing;
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isSyncing = false;
  }

  /**
   * Main sync method - orchestrates pull and push
   */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        direction: options.direction ?? "both",
        pulled: 0,
        pushed: 0,
        failed: 0,
        errors: ["Sync already in progress"],
        duration: 0,
      };
    }

    this.isSyncing = true;
    this.abortController = new AbortController();
    const startTime = Date.now();

    const result: SyncResult = {
      success: true,
      direction: options.direction ?? "both",
      pulled: 0,
      pushed: 0,
      failed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const direction = options.direction ?? "both";

      // Pull first (get latest server state)
      if (direction === "pull" || direction === "both") {
        const pullResults = await this.pullAll(options);
        for (const pr of pullResults) {
          result.pulled += pr.inserted + pr.updated;
        }
      }

      // Then push local changes
      if (direction === "push" || direction === "both") {
        const pushResult = await this.pushAll();
        result.pushed = pushResult.succeeded;
        result.failed = pushResult.failed;
        result.errors.push(...pushResult.errors.map((e) => e.error));
      }

      result.success = result.failed === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(
        error instanceof Error ? error.message : "Unknown sync error",
      );
    } finally {
      this.isSyncing = false;
      this.abortController = null;
      result.duration = Date.now() - startTime;
    }

    logger.debug(
      `[SyncManager] Sync complete: pulled=${result.pulled}, pushed=${result.pushed}, failed=${result.failed}, duration=${result.duration}ms`,
    );
    return result;
  }

  // ===========================================================================
  // Pull Operations
  // ===========================================================================

  async pullAll(options: SyncOptions): Promise<PullResult[]> {
    const results: PullResult[] = [];
    const { festivalId, userId } = options;

    if (!festivalId) {
      logger.warn("[SyncManager] No festivalId provided, skipping pull");
      return results;
    }

    try {
      // Disable foreign key checks during sync to avoid constraint failures
      await this.db.execAsync("PRAGMA foreign_keys = OFF");
      logger.debug("[SyncManager] Foreign keys disabled for sync");

      // Pull reference data first
      results.push(await pullFestivals(this.db));
      results.push(await pullTents(this.db, festivalId));
      results.push(await pullAchievements(this.db));

      // Pull user data
      if (userId) {
        results.push(await pullProfile(this.db, userId));
        results.push(await pullAttendances(this.db, festivalId));
        results.push(await pullConsumptions(this.db, festivalId));
        results.push(await pullGroups(this.db, festivalId));
        results.push(await pullGroupMembers(this.db, festivalId));
        results.push(await pullUserAchievements(this.db, festivalId));
      }
    } catch (error) {
      logger.error("[SyncManager] Pull failed:", error);
      throw error;
    } finally {
      await this.db.execAsync("PRAGMA foreign_keys = ON");
      logger.debug("[SyncManager] Foreign keys re-enabled after sync");
    }

    return results;
  }

  // ===========================================================================
  // Push Operations
  // ===========================================================================

  async pushAll(): Promise<ProcessorResult> {
    const processor = new QueueProcessor(this.db, {
      signal: this.abortController?.signal ?? undefined,
    });

    processor.registerHandler("INSERT", async (op) => {
      const payload = JSON.parse(op.payload);
      await pushInsert(op.table_name, op.record_id, payload);
    });
    processor.registerHandler("UPDATE", async (op) => {
      const payload = JSON.parse(op.payload);
      await pushUpdate(op.table_name, op.record_id, payload);
    });
    processor.registerHandler("DELETE", async (op) => {
      await pushDelete(op.table_name, op.record_id);
    });
    processor.registerHandler("UPLOAD_FILE", async () => {
      // File uploads handled by photo-queue
    });

    return processor.processQueue();
  }

  // ===========================================================================
  // Status
  // ===========================================================================

  async getStatus(): Promise<{
    pendingOperations: number;
    failedOperations: number;
    dirtyRecords: number;
    lastSyncAt: string | null;
  }> {
    const queueStats = await getQueueStats(this.db);

    let dirtyCount = 0;
    for (const table of MUTABLE_TABLES) {
      const result = await this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${table} WHERE _dirty = 1`,
      );
      dirtyCount += result?.count ?? 0;
    }

    const syncMeta = await getSyncMetadata(this.db, "attendances");

    return {
      pendingOperations: queueStats.pending,
      failedOperations: queueStats.failed,
      dirtyRecords: dirtyCount,
      lastSyncAt: syncMeta?.last_sync_at ?? null,
    };
  }
}

/**
 * Creates a new SyncManager instance
 */
export function createSyncManager(db: SQLite.SQLiteDatabase): SyncManager {
  return new SyncManager(db);
}
