/**
 * Sync Manager
 *
 * Lean orchestrator that coordinates pull and push sync operations.
 * Domain logic lives in the pull-* and push-* modules.
 */

import type * as SQLite from "expo-sqlite";

import { logger } from "@/lib/logger";

import { MUTABLE_TABLES, type SyncQueueItem } from "../schema";
import {
  getPendingOperations,
  getQueueStats,
  getSyncMetadata,
  markOperationCompleted,
  markOperationFailed,
  markOperationProcessing,
} from "../sync-queue";
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
import { pushDirtyRecords } from "./push-dirty";
import { pushDelete, pushInsert, pushUpdate } from "./push-handlers";
import type { PullResult, PushResult, SyncOptions, SyncResult } from "./types";

// Re-export types for consumers
export type {
  PullResult,
  PushResult,
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
        const pushResults = await this.pushAll();
        result.pushed = pushResults.filter((r) => r.success).length;
        result.failed = pushResults.filter((r) => !r.success).length;
        result.errors.push(
          ...pushResults.filter((r) => r.error).map((r) => r.error!),
        );
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

  async pushAll(): Promise<PushResult[]> {
    const results: PushResult[] = [];

    // Process queued operations
    const pendingOps = await getPendingOperations(this.db);
    logger.debug(
      `[SyncManager] Processing ${pendingOps.length} pending operations`,
    );

    for (const op of pendingOps) {
      if (this.abortController?.signal.aborted) {
        break;
      }
      const result = await this.processOperation(op);
      results.push(result);
    }

    // Also push dirty records that aren't queued
    const dirtyResults = await pushDirtyRecords(this.db);
    results.push(...dirtyResults);

    return results;
  }

  private async processOperation(op: SyncQueueItem): Promise<PushResult> {
    const result: PushResult = {
      operationId: op.id,
      success: false,
    };

    try {
      await markOperationProcessing(this.db, op.id);
      const payload = JSON.parse(op.payload);

      switch (op.operation) {
        case "INSERT":
          await pushInsert(op.table_name, op.record_id, payload);
          break;
        case "UPDATE":
          await pushUpdate(op.table_name, op.record_id, payload);
          break;
        case "DELETE":
          await pushDelete(op.table_name, op.record_id);
          break;
        case "UPLOAD_FILE":
          // File uploads are handled separately by photo-queue
          break;
      }

      await markOperationCompleted(this.db, op.id);
      result.success = true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      await markOperationFailed(this.db, op.id, errorMsg);
      result.error = errorMsg;
      logger.error(`[SyncManager] Operation ${op.id} failed:`, error);
    }

    return result;
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
