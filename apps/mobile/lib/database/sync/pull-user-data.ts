/**
 * Pull User Data
 *
 * Sync operations for user-specific tables:
 * profiles, attendances, consumptions.
 */

import type * as SQLite from "expo-sqlite";

import { logger } from "@/lib/logger";

import { apiClient } from "../../api-client";
import type {
  LocalAttendance,
  LocalConsumption,
  LocalProfile,
} from "../schema";
import { updateLastSyncAt } from "../sync-queue";
import { logConflict, shouldUpdate } from "./conflict";
import type { PullResult } from "./types";

/**
 * Pull user profile from server
 */
export async function pullProfile(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<PullResult> {
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

    const existing = await db.getFirstAsync<LocalProfile>(
      "SELECT * FROM profiles WHERE id = ?",
      [userId],
    );

    if (existing) {
      // Only update if not dirty (don't overwrite local changes)
      if (existing._dirty === 0) {
        await db.runAsync(
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
      await db.runAsync(
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

    await updateLastSyncAt(db, "profiles", now);
  } catch (error) {
    logger.error("[SyncManager] Pull profile failed:", error);
  }

  return result;
}

/**
 * Pull attendances from server
 */
export async function pullAttendances(
  db: SQLite.SQLiteDatabase,
  festivalId: string,
): Promise<PullResult> {
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
      const existing = await db.getFirstAsync<LocalAttendance>(
        "SELECT * FROM attendances WHERE id = ?",
        [att.id],
      );

      if (existing) {
        // Use last-write-wins conflict resolution
        const serverUpdatedAt = att.updatedAt ?? att.createdAt;
        if (shouldUpdate(existing, serverUpdatedAt)) {
          await db.runAsync(
            `UPDATE attendances SET
              beer_count = ?, updated_at = ?, _synced_at = ?, _dirty = 0
            WHERE id = ?`,
            [att.beerCount, serverUpdatedAt, now, att.id],
          );
          result.updated++;

          // Log if there was a conflict (local had dirty changes)
          if (existing._dirty === 1) {
            logConflict(
              "attendances",
              att.id,
              existing.updated_at,
              serverUpdatedAt,
              "server",
            );
          }
        } else if (existing._dirty === 1) {
          // Local wins - log the conflict
          logConflict(
            "attendances",
            att.id,
            existing.updated_at,
            serverUpdatedAt,
            "local",
          );
        }
      } else {
        await db.runAsync(
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

    await updateLastSyncAt(db, "attendances", now);
  } catch (error) {
    logger.error("[SyncManager] Pull attendances failed:", error);
  }

  return result;
}

/**
 * Pull consumptions for all attendances
 */
export async function pullConsumptions(
  db: SQLite.SQLiteDatabase,
  festivalId: string,
): Promise<PullResult> {
  const result: PullResult = {
    table: "consumptions",
    inserted: 0,
    updated: 0,
    deleted: 0,
  };

  try {
    // Get all local attendances
    const attendances = await db.getAllAsync<LocalAttendance>(
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
          const existing = await db.getFirstAsync<LocalConsumption>(
            "SELECT * FROM consumptions WHERE id = ?",
            [cons.id],
          );

          if (existing) {
            // Use last-write-wins conflict resolution
            if (shouldUpdate(existing, cons.updatedAt)) {
              await db.runAsync(
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
                logConflict(
                  "consumptions",
                  cons.id,
                  existing.updated_at,
                  cons.updatedAt,
                  "server",
                );
              }
            } else if (existing._dirty === 1) {
              // Local wins
              logConflict(
                "consumptions",
                cons.id,
                existing.updated_at,
                cons.updatedAt,
                "local",
              );
            }
          } else {
            await db.runAsync(
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

    await updateLastSyncAt(db, "consumptions", now);
  } catch (error) {
    logger.error("[SyncManager] Pull consumptions failed:", error);
  }

  return result;
}
