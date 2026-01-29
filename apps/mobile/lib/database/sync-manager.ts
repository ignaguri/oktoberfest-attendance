/**
 * Sync Manager
 *
 * Orchestrates synchronization between local SQLite database and remote Supabase.
 * Handles:
 * - Pull: Fetch changes from server and update local database
 * - Push: Send local changes to server
 * - Conflict resolution (server wins)
 *
 * Sync is designed to be resilient:
 * - Operations are queued and can retry
 * - Idempotency keys prevent duplicate operations
 * - Server always wins conflicts
 */

import type * as SQLite from "expo-sqlite";

import { logger } from "@/lib/logger";

import { apiClient } from "../api-client";
import type {
  LocalAchievement,
  LocalAttendance,
  LocalConsumption,
  LocalFestival,
  LocalGroup,
  LocalProfile,
  LocalTent,
  LocalUserAchievement,
  SyncQueueItem,
} from "./schema";
import { MUTABLE_TABLES } from "./schema";
import {
  generateUUID,
  getDirtyRecords,
  getPendingOperations,
  getQueueStats,
  getSyncMetadata,
  markOperationCompleted,
  markOperationFailed,
  markOperationProcessing,
  markRecordClean,
  updateLastSyncAt,
} from "./sync-queue";

// =============================================================================
// Types
// =============================================================================

export type SyncDirection = "pull" | "push" | "both";

export interface SyncOptions {
  /** Which direction to sync */
  direction?: SyncDirection;
  /** Specific tables to sync (default: all) */
  tables?: string[];
  /** Force full sync (ignore last_sync_at) */
  force?: boolean;
  /** Festival ID to scope sync */
  festivalId?: string;
  /** User ID for user-scoped data */
  userId?: string;
}

export interface SyncResult {
  success: boolean;
  direction: SyncDirection;
  pulled: number;
  pushed: number;
  failed: number;
  errors: string[];
  duration: number;
}

export interface PullResult {
  table: string;
  inserted: number;
  updated: number;
  deleted: number;
}

export interface PushResult {
  operationId: string;
  success: boolean;
  error?: string;
}

// =============================================================================
// Sync Manager Class
// =============================================================================

export class SyncManager {
  private db: SQLite.SQLiteDatabase;
  private isSyncing = false;
  private abortController: AbortController | null = null;

  constructor(db: SQLite.SQLiteDatabase) {
    this.db = db;
  }

  /**
   * Check if sync is currently in progress
   */
  get syncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Abort any in-progress sync
   */
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
        const pushResults = await this.pushAll(options);
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

  /**
   * Pull all tables from server
   */
  async pullAll(options: SyncOptions): Promise<PullResult[]> {
    const results: PullResult[] = [];
    const { festivalId, userId } = options;

    if (!festivalId) {
      logger.warn("[SyncManager] No festivalId provided, skipping pull");
      return results;
    }

    try {
      // Disable foreign key checks during sync to avoid constraint failures
      // (e.g., attendances referencing user_ids not yet in local profiles table)
      await this.db.execAsync("PRAGMA foreign_keys = OFF");
      logger.debug("[SyncManager] Foreign keys disabled for sync");

      // Pull reference data first (festivals, tents, achievements)
      results.push(await this.pullFestivals());
      results.push(await this.pullTents(festivalId));
      results.push(await this.pullAchievements());

      // Pull user data
      if (userId) {
        results.push(await this.pullProfile(userId));
        results.push(await this.pullAttendances(festivalId));
        results.push(await this.pullConsumptions(festivalId));
        results.push(await this.pullGroups(festivalId));
        results.push(await this.pullUserAchievements(festivalId));
      }
    } catch (error) {
      logger.error("[SyncManager] Pull failed:", error);
      throw error;
    } finally {
      // Re-enable foreign key checks
      await this.db.execAsync("PRAGMA foreign_keys = ON");
      logger.debug("[SyncManager] Foreign keys re-enabled after sync");
    }

    return results;
  }

  /**
   * Pull festivals from server
   */
  async pullFestivals(): Promise<PullResult> {
    const result: PullResult = {
      table: "festivals",
      inserted: 0,
      updated: 0,
      deleted: 0,
    };

    try {
      const response = await apiClient.festivals.list();
      const festivals = response.data;
      const now = new Date().toISOString();

      for (const festival of festivals) {
        const existing = await this.db.getFirstAsync<LocalFestival>(
          "SELECT * FROM festivals WHERE id = ?",
          [festival.id],
        );

        // Generate short_name from name (API doesn't return this field)
        const shortName = festival.name
          .substring(0, 20)
          .toLowerCase()
          .replace(/\s+/g, "-");

        if (existing) {
          // Update if server is newer
          if (this.shouldUpdate(existing, festival.updatedAt)) {
            await this.db.runAsync(
              `UPDATE festivals SET
                name = ?, short_name = ?, location = ?,
                start_date = ?, end_date = ?, status = ?,
                is_active = ?, beer_cost = ?,
                timezone = ?, map_url = ?, updated_at = ?, _synced_at = ?, _dirty = 0
              WHERE id = ?`,
              [
                festival.name,
                shortName,
                festival.location,
                festival.startDate,
                festival.endDate,
                festival.status,
                festival.isActive ? 1 : 0,
                festival.beerCost ?? null,
                festival.timezone ?? "Europe/Berlin",
                festival.mapUrl ?? null,
                festival.updatedAt,
                now,
                festival.id,
              ],
            );
            result.updated++;
          }
        } else {
          // Insert new
          await this.db.runAsync(
            `INSERT INTO festivals (
              id, name, short_name, description, location,
              start_date, end_date, festival_type, status,
              is_active, beer_cost, default_beer_price_cents,
              timezone, map_url, created_at, updated_at, _synced_at, _dirty, _deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
            [
              festival.id,
              festival.name,
              shortName,
              null, // description - API doesn't return this
              festival.location,
              festival.startDate,
              festival.endDate,
              "oktoberfest", // festival_type - default
              festival.status,
              festival.isActive ? 1 : 0,
              festival.beerCost ?? null,
              null, // default_beer_price_cents - API doesn't return this
              festival.timezone ?? "Europe/Berlin",
              festival.mapUrl ?? null,
              festival.createdAt,
              festival.updatedAt,
              now,
            ],
          );
          result.inserted++;
        }
      }

      await updateLastSyncAt(this.db, "festivals", now);
    } catch (error) {
      logger.error("[SyncManager] Pull festivals failed:", error);
    }

    return result;
  }

  /**
   * Pull tents from server
   */
  async pullTents(festivalId: string): Promise<PullResult> {
    const result: PullResult = {
      table: "tents",
      inserted: 0,
      updated: 0,
      deleted: 0,
    };

    try {
      const response = await apiClient.tents.list({ festivalId });
      const festivalTents = response.data;
      const now = new Date().toISOString();

      for (const ft of festivalTents) {
        const tent = ft.tent;
        const existing = await this.db.getFirstAsync<LocalTent>(
          "SELECT * FROM tents WHERE id = ?",
          [tent.id],
        );

        if (existing) {
          await this.db.runAsync(
            `UPDATE tents SET name = ?, category = ?, _synced_at = ?, _dirty = 0 WHERE id = ?`,
            [tent.name, tent.category ?? null, now, tent.id],
          );
          result.updated++;
        } else {
          await this.db.runAsync(
            `INSERT INTO tents (id, name, category, _synced_at, _dirty, _deleted)
             VALUES (?, ?, ?, ?, 0, 0)`,
            [tent.id, tent.name, tent.category ?? null, now],
          );
          result.inserted++;
        }
      }

      await updateLastSyncAt(this.db, "tents", now);
    } catch (error) {
      logger.error("[SyncManager] Pull tents failed:", error);
    }

    return result;
  }

  /**
   * Pull achievements from server
   */
  async pullAchievements(): Promise<PullResult> {
    const result: PullResult = {
      table: "achievements",
      inserted: 0,
      updated: 0,
      deleted: 0,
    };

    try {
      const response = await apiClient.achievements.available();
      const achievements = response.data;
      const now = new Date().toISOString();

      for (const ach of achievements) {
        const existing = await this.db.getFirstAsync<LocalAchievement>(
          "SELECT * FROM achievements WHERE id = ?",
          [ach.id],
        );

        if (existing) {
          await this.db.runAsync(
            `UPDATE achievements SET
              name = ?, description = ?, icon = ?, category = ?,
              rarity = ?, points = ?, is_active = ?, updated_at = ?,
              _synced_at = ?, _dirty = 0
            WHERE id = ?`,
            [
              ach.name,
              ach.description,
              ach.icon,
              ach.category,
              ach.rarity,
              ach.points,
              ach.is_active ? 1 : 0,
              now,
              now,
              ach.id,
            ],
          );
          result.updated++;
        } else {
          await this.db.runAsync(
            `INSERT INTO achievements (
              id, name, description, icon, category, rarity, points,
              conditions, is_active, created_at, updated_at, _synced_at, _dirty, _deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
            [
              ach.id,
              ach.name,
              ach.description,
              ach.icon,
              ach.category,
              ach.rarity,
              ach.points,
              "{}", // conditions - API doesn't return this, use empty JSON
              ach.is_active ? 1 : 0,
              now, // created_at - API doesn't return this
              now, // updated_at
              now, // _synced_at
            ],
          );
          result.inserted++;
        }
      }

      await updateLastSyncAt(this.db, "achievements", now);
    } catch (error) {
      logger.error("[SyncManager] Pull achievements failed:", error);
    }

    return result;
  }

  /**
   * Pull user profile from server
   */
  async pullProfile(userId: string): Promise<PullResult> {
    const result: PullResult = {
      table: "profiles",
      inserted: 0,
      updated: 0,
      deleted: 0,
    };

    try {
      const response = await apiClient.profile.get();
      const profile = response.profile;
      const now = new Date().toISOString();

      const existing = await this.db.getFirstAsync<LocalProfile>(
        "SELECT * FROM profiles WHERE id = ?",
        [userId],
      );

      if (existing) {
        // Only update if not dirty (don't overwrite local changes)
        if (existing._dirty === 0) {
          await this.db.runAsync(
            `UPDATE profiles SET
              username = ?, full_name = ?, avatar_url = ?,
              updated_at = ?, _synced_at = ?
            WHERE id = ?`,
            [
              profile.username ?? null,
              profile.full_name ?? null,
              profile.avatar_url ?? null,
              now,
              now,
              userId,
            ],
          );
          result.updated++;
        }
      } else {
        await this.db.runAsync(
          `INSERT INTO profiles (
            id, username, full_name, avatar_url, updated_at,
            _synced_at, _dirty, _deleted
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
          [
            userId,
            profile.username ?? null,
            profile.full_name ?? null,
            profile.avatar_url ?? null,
            now,
            now,
          ],
        );
        result.inserted++;
      }

      await updateLastSyncAt(this.db, "profiles", now);
    } catch (error) {
      logger.error("[SyncManager] Pull profile failed:", error);
    }

    return result;
  }

  /**
   * Pull attendances from server
   */
  async pullAttendances(festivalId: string): Promise<PullResult> {
    const result: PullResult = {
      table: "attendances",
      inserted: 0,
      updated: 0,
      deleted: 0,
    };

    try {
      const response = await apiClient.attendance.list({
        festivalId,
        limit: 100,
      });
      const attendances = response.data;
      const now = new Date().toISOString();

      for (const att of attendances) {
        const existing = await this.db.getFirstAsync<LocalAttendance>(
          "SELECT * FROM attendances WHERE id = ?",
          [att.id],
        );

        if (existing) {
          // Use last-write-wins conflict resolution
          const serverUpdatedAt = att.updatedAt ?? att.createdAt;
          if (this.shouldUpdate(existing, serverUpdatedAt)) {
            await this.db.runAsync(
              `UPDATE attendances SET
                beer_count = ?, updated_at = ?, _synced_at = ?, _dirty = 0
              WHERE id = ?`,
              [att.beerCount, serverUpdatedAt, now, att.id],
            );
            result.updated++;

            // Log if there was a conflict (local had dirty changes)
            if (existing._dirty === 1) {
              this.logConflict(
                "attendances",
                att.id,
                existing.updated_at,
                serverUpdatedAt,
                "server",
              );
            }
          } else if (existing._dirty === 1) {
            // Local wins - log the conflict
            this.logConflict(
              "attendances",
              att.id,
              existing.updated_at,
              serverUpdatedAt,
              "local",
            );
          }
        } else {
          await this.db.runAsync(
            `INSERT INTO attendances (
              id, user_id, festival_id, date, beer_count,
              created_at, updated_at, _synced_at, _dirty, _deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
            [
              att.id,
              att.userId,
              att.festivalId,
              att.date,
              att.beerCount,
              att.createdAt,
              att.updatedAt ?? att.createdAt,
              now,
            ],
          );
          result.inserted++;
        }
      }

      await updateLastSyncAt(this.db, "attendances", now);
    } catch (error) {
      logger.error("[SyncManager] Pull attendances failed:", error);
    }

    return result;
  }

  /**
   * Pull consumptions for all attendances
   */
  async pullConsumptions(festivalId: string): Promise<PullResult> {
    const result: PullResult = {
      table: "consumptions",
      inserted: 0,
      updated: 0,
      deleted: 0,
    };

    try {
      // Get all local attendances
      const attendances = await this.db.getAllAsync<LocalAttendance>(
        "SELECT * FROM attendances WHERE festival_id = ? AND _deleted = 0",
        [festivalId],
      );

      const now = new Date().toISOString();

      for (const att of attendances) {
        try {
          const response = await apiClient.consumption.list({
            festivalId,
            date: att.date,
          });
          const consumptions = response.consumptions;

          for (const cons of consumptions) {
            const existing = await this.db.getFirstAsync<LocalConsumption>(
              "SELECT * FROM consumptions WHERE id = ?",
              [cons.id],
            );

            if (existing) {
              // Use last-write-wins conflict resolution
              if (this.shouldUpdate(existing, cons.updatedAt)) {
                await this.db.runAsync(
                  `UPDATE consumptions SET
                    drink_type = ?, drink_name = ?, volume_ml = ?,
                    price_paid_cents = ?, base_price_cents = ?, tip_cents = ?,
                    tent_id = ?, recorded_at = ?, updated_at = ?, _synced_at = ?, _dirty = 0
                  WHERE id = ?`,
                  [
                    cons.drinkType,
                    cons.drinkName ?? null,
                    cons.volumeMl ?? null,
                    cons.pricePaidCents,
                    cons.basePriceCents,
                    cons.tipCents ?? null,
                    cons.tentId ?? null,
                    cons.recordedAt,
                    cons.updatedAt,
                    now,
                    cons.id,
                  ],
                );
                result.updated++;

                // Log if there was a conflict
                if (existing._dirty === 1) {
                  this.logConflict(
                    "consumptions",
                    cons.id,
                    existing.updated_at,
                    cons.updatedAt,
                    "server",
                  );
                }
              } else if (existing._dirty === 1) {
                // Local wins
                this.logConflict(
                  "consumptions",
                  cons.id,
                  existing.updated_at,
                  cons.updatedAt,
                  "local",
                );
              }
            } else {
              await this.db.runAsync(
                `INSERT INTO consumptions (
                  id, attendance_id, drink_type, drink_name, volume_ml,
                  price_paid_cents, base_price_cents, tip_cents, tent_id,
                  recorded_at, idempotency_key, created_at, updated_at,
                  _synced_at, _dirty, _deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
                [
                  cons.id,
                  cons.attendanceId,
                  cons.drinkType,
                  cons.drinkName ?? null,
                  cons.volumeMl ?? null,
                  cons.pricePaidCents,
                  cons.basePriceCents,
                  cons.tipCents ?? null,
                  cons.tentId ?? null,
                  cons.recordedAt,
                  null, // idempotencyKey not returned from API
                  cons.createdAt,
                  cons.updatedAt,
                  now,
                ],
              );
              result.inserted++;
            }
          }
        } catch (error) {
          logger.error(
            `[SyncManager] Pull consumptions for ${att.date} failed:`,
            error,
          );
        }
      }

      await updateLastSyncAt(this.db, "consumptions", now);
    } catch (error) {
      logger.error("[SyncManager] Pull consumptions failed:", error);
    }

    return result;
  }

  /**
   * Pull groups from server
   */
  async pullGroups(festivalId: string): Promise<PullResult> {
    const result: PullResult = {
      table: "groups",
      inserted: 0,
      updated: 0,
      deleted: 0,
    };

    try {
      const response = await apiClient.groups.list({ festivalId });
      const groups = response.data;
      const now = new Date().toISOString();

      for (const group of groups) {
        const existing = await this.db.getFirstAsync<LocalGroup>(
          "SELECT * FROM groups WHERE id = ?",
          [group.id],
        );

        if (existing) {
          await this.db.runAsync(
            `UPDATE groups SET
              name = ?, description = ?, winning_criteria_id = ?,
              _synced_at = ?, _dirty = 0
            WHERE id = ?`,
            [
              group.name,
              group.description ?? null,
              group.winningCriteria,
              now,
              group.id,
            ],
          );
          result.updated++;
        } else {
          await this.db.runAsync(
            `INSERT INTO groups (
              id, name, description, festival_id, created_by, password,
              invite_token, winning_criteria_id, created_at,
              _synced_at, _dirty, _deleted
            ) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, 0, 0)`,
            [
              group.id,
              group.name,
              group.description ?? null,
              group.festivalId,
              group.createdBy,
              group.inviteToken,
              group.winningCriteria,
              group.createdAt,
              now,
            ],
          );
          result.inserted++;
        }

        // Note: Group members need to be fetched separately via group details API
        // For now, we only sync the groups themselves
      }

      await updateLastSyncAt(this.db, "groups", now);
    } catch (error) {
      logger.error("[SyncManager] Pull groups failed:", error);
    }

    return result;
  }

  /**
   * Pull user achievements from server
   */
  async pullUserAchievements(festivalId: string): Promise<PullResult> {
    const result: PullResult = {
      table: "user_achievements",
      inserted: 0,
      updated: 0,
      deleted: 0,
    };

    try {
      const response = await apiClient.achievements.getWithProgress(festivalId);
      const achievements = response.data;
      const now = new Date().toISOString();

      for (const ach of achievements) {
        // Check if user has unlocked this achievement (100% progress)
        const userProgress = ach.user_progress;
        if (!userProgress || userProgress.percentage < 100) continue;

        const existing = await this.db.getFirstAsync<LocalUserAchievement>(
          "SELECT * FROM user_achievements WHERE achievement_id = ? AND festival_id = ?",
          [ach.id, festivalId],
        );

        if (!existing) {
          await this.db.runAsync(
            `INSERT INTO user_achievements (
              id, user_id, achievement_id, festival_id, unlocked_at, progress,
              _synced_at, _dirty, _deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
            [
              generateUUID(),
              "", // Will be set by trigger/context
              ach.id,
              festivalId,
              userProgress.last_updated ?? now,
              JSON.stringify({
                current_value: userProgress.current_value,
                target_value: userProgress.target_value,
              }),
              now,
            ],
          );
          result.inserted++;
        }
      }

      await updateLastSyncAt(this.db, "user_achievements", now);
    } catch (error) {
      logger.error("[SyncManager] Pull user achievements failed:", error);
    }

    return result;
  }

  // ===========================================================================
  // Push Operations
  // ===========================================================================

  /**
   * Push all pending changes to server
   */
  async pushAll(options: SyncOptions): Promise<PushResult[]> {
    const results: PushResult[] = [];

    // Get pending operations from queue
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
    const dirtyResults = await this.pushDirtyRecords(options);
    results.push(...dirtyResults);

    return results;
  }

  /**
   * Process a single sync queue operation
   */
  async processOperation(op: SyncQueueItem): Promise<PushResult> {
    const result: PushResult = {
      operationId: op.id,
      success: false,
    };

    try {
      await markOperationProcessing(this.db, op.id);

      const payload = JSON.parse(op.payload);

      switch (op.operation) {
        case "INSERT":
          await this.pushInsert(op.table_name, op.record_id, payload);
          break;
        case "UPDATE":
          await this.pushUpdate(op.table_name, op.record_id, payload);
          break;
        case "DELETE":
          await this.pushDelete(op.table_name, op.record_id);
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

  /**
   * Push an INSERT operation to server
   */
  private async pushInsert(
    tableName: string,
    recordId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    switch (tableName) {
      case "attendances":
        await apiClient.attendance.updatePersonal({
          festivalId: payload.festival_id as string,
          date: payload.date as string,
          amount: payload.beer_count as number,
          tents: payload.tents as string[] | undefined,
        });
        break;
      case "consumptions": {
        // Support both camelCase (from useOfflineConsumption) and snake_case (from local DB sync)
        const festivalId = (payload.festivalId ||
          payload.festival_id) as string;
        const date = payload.date as string;
        const drinkType = (payload.drinkType || payload.drink_type) as
          | "beer"
          | "radler"
          | "alcohol_free"
          | "wine"
          | "soft_drink"
          | "other";
        const tentId = (payload.tentId || payload.tent_id) as
          | string
          | undefined;
        const pricePaidCents =
          typeof payload.pricePaidCents === "number"
            ? payload.pricePaidCents
            : typeof payload.price_paid_cents === "number"
              ? payload.price_paid_cents
              : 0;
        const volumeMl =
          typeof payload.volumeMl === "number"
            ? payload.volumeMl
            : typeof payload.volume_ml === "number"
              ? payload.volume_ml
              : 1000; // Default to 1L (Mass)

        await apiClient.consumption.log({
          festivalId,
          date,
          drinkType,
          tentId,
          pricePaidCents,
          volumeMl,
        });
        break;
      }
      default:
        logger.warn(`[SyncManager] No insert handler for table: ${tableName}`);
    }
  }

  /**
   * Push an UPDATE operation to server
   */
  private async pushUpdate(
    tableName: string,
    recordId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    switch (tableName) {
      case "attendances":
        await apiClient.attendance.updatePersonal({
          festivalId: payload.festival_id as string,
          date: payload.date as string,
          amount: payload.beer_count as number,
          tents: payload.tents as string[] | undefined,
        });
        break;
      case "consumptions": {
        // For consumptions, we update by deleting and re-creating
        // since the API doesn't have an update endpoint
        const festivalId = (payload.festivalId ||
          payload.festival_id) as string;
        const date = payload.date as string;
        const drinkType = (payload.drinkType || payload.drink_type) as
          | "beer"
          | "radler"
          | "alcohol_free"
          | "wine"
          | "soft_drink"
          | "other";
        const pricePaidCents =
          typeof payload.pricePaidCents === "number"
            ? payload.pricePaidCents
            : typeof payload.price_paid_cents === "number"
              ? payload.price_paid_cents
              : 0;
        const volumeMl =
          typeof payload.volumeMl === "number"
            ? payload.volumeMl
            : typeof payload.volume_ml === "number"
              ? payload.volume_ml
              : 1000;

        // Delete existing and create new
        try {
          await apiClient.consumption.delete(recordId);
        } catch {
          // Ignore delete errors (record may not exist on server)
        }
        await apiClient.consumption.log({
          festivalId,
          date,
          drinkType,
          pricePaidCents,
          volumeMl,
          tentId: (payload.tentId || payload.tent_id) as string | undefined,
        });
        break;
      }
      case "profiles":
        await apiClient.profile.update({
          username: payload.username as string | undefined,
          full_name: payload.full_name as string | undefined,
        });
        break;
      default:
        logger.warn(`[SyncManager] No update handler for table: ${tableName}`);
    }
  }

  /**
   * Push a DELETE operation to server
   */
  private async pushDelete(tableName: string, recordId: string): Promise<void> {
    switch (tableName) {
      case "attendances":
        await apiClient.attendance.delete(recordId);
        break;
      case "consumptions":
        await apiClient.consumption.delete(recordId);
        break;
      default:
        logger.warn(`[SyncManager] No delete handler for table: ${tableName}`);
    }
  }

  /**
   * Push dirty records that aren't in the queue
   */
  private async pushDirtyRecords(options: SyncOptions): Promise<PushResult[]> {
    const results: PushResult[] = [];
    const now = new Date().toISOString();

    // Push dirty attendances
    const dirtyAttendances = await getDirtyRecords<LocalAttendance>(
      this.db,
      "attendances",
    );
    for (const att of dirtyAttendances) {
      try {
        await apiClient.attendance.updatePersonal({
          festivalId: att.festival_id,
          date: att.date,
          amount: att.beer_count,
        });
        await markRecordClean(this.db, "attendances", att.id, now);
        results.push({ operationId: att.id, success: true });
      } catch (error) {
        results.push({
          operationId: att.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  // Clock drift tolerance for last-write-wins comparison (1 second)
  private readonly CLOCK_DRIFT_TOLERANCE_MS = 1000;

  /**
   * Check if a local record should be updated with server data.
   * Implements last-write-wins conflict resolution:
   * - If local has uncommitted changes (_dirty=1), compare updated_at timestamps
   * - Local wins if it was modified more recently than server
   * - Server wins otherwise
   */
  private shouldUpdate(
    local: {
      updated_at?: string | null;
      _synced_at: string | null;
      _dirty?: number;
    },
    serverUpdatedAt: string | null | undefined,
  ): boolean {
    if (!serverUpdatedAt) return false;
    if (!local._synced_at) return true;

    const serverTime = new Date(serverUpdatedAt).getTime();

    // If local has uncommitted changes, use last-write-wins
    if (local._dirty === 1 && local.updated_at) {
      const localTime = new Date(local.updated_at).getTime();

      // Local wins if it was modified more recently (with clock drift tolerance)
      if (localTime > serverTime + this.CLOCK_DRIFT_TOLERANCE_MS) {
        logger.debug(
          `[SyncManager] Conflict resolved: keeping local (local=${local.updated_at} > server=${serverUpdatedAt})`,
        );
        return false; // Keep local, don't update from server
      }

      // Server wins - log the conflict
      logger.debug(
        `[SyncManager] Conflict resolved: server wins (server=${serverUpdatedAt} >= local=${local.updated_at})`,
      );
    }

    const localSyncTime = new Date(local._synced_at).getTime();
    return serverTime > localSyncTime - this.CLOCK_DRIFT_TOLERANCE_MS;
  }

  /**
   * Log a sync conflict for debugging/analytics
   */
  private logConflict(
    table: string,
    recordId: string,
    localUpdatedAt: string | null,
    serverUpdatedAt: string | null,
    winner: "local" | "server",
  ): void {
    logger.info(`[SyncManager] Sync conflict on ${table}/${recordId}`, {
      localUpdatedAt,
      serverUpdatedAt,
      winner,
    });
  }

  /**
   * Get sync status summary
   */
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

    // Get most recent sync time
    const syncMeta = await getSyncMetadata(this.db, "attendances");

    return {
      pendingOperations: queueStats.pending,
      failedOperations: queueStats.failed,
      dirtyRecords: dirtyCount,
      lastSyncAt: syncMeta?.last_sync_at ?? null,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a new SyncManager instance
 */
export function createSyncManager(db: SQLite.SQLiteDatabase): SyncManager {
  return new SyncManager(db);
}
