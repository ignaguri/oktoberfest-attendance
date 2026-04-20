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
  LocalTentVisit,
} from "../schema";
import { updateLastSyncAt } from "../sync-queue";
import { logConflict, shouldUpdate } from "./conflict";
import type { PullResult } from "./types";

type ServerTentVisit = {
  id: string;
  userId: string;
  tentId: string;
  festivalId: string;
  visitDate: string;
  tentName: string | null;
};

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
 * Pull attendances (and tent_visits) from server.
 *
 * Returns two PullResults: one for attendances, one for tent_visits.
 * Both tables are pulled from the same `GET /attendance?include=tent_visits`
 * response to avoid a second round-trip.
 */
export async function pullAttendances(
  db: SQLite.SQLiteDatabase,
  festivalId: string,
): Promise<PullResult[]> {
  const attendancesResult: PullResult = {
    table: "attendances",
    inserted: 0,
    updated: 0,
    deleted: 0,
  };
  const tentVisitsResult: PullResult = {
    table: "tent_visits",
    inserted: 0,
    updated: 0,
    deleted: 0,
  };

  try {
    const response = await apiClient.attendance.list({
      festivalId,
      limit: 100,
      include: "tent_visits",
    });
    const attendances = response.data;
    const now = new Date().toISOString();

    await processAttendances(db, attendances, attendancesResult, now);
    await updateLastSyncAt(db, "attendances", now);

    await processTentVisits(
      db,
      response.tentVisits ?? [],
      tentVisitsResult,
      now,
    );
    await updateLastSyncAt(db, "tent_visits", now);
  } catch (error) {
    logger.error("[SyncManager] Pull attendances failed:", error);
  }

  return [attendancesResult, tentVisitsResult];
}

async function processAttendances(
  db: SQLite.SQLiteDatabase,
  attendances: Array<{
    id: string;
    userId: string;
    festivalId: string;
    date: string;
    createdAt: string;
    updatedAt?: string;
    beerCount: number;
  }>,
  result: PullResult,
  now: string,
): Promise<void> {
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
      // No local record with this server ID — check if one exists with a
      // different (client-generated) ID for the same natural key.
      // This happens when attendance was created offline with a local UUID
      // and synced via updatePersonal (which uses natural key, not ID).
      const byNaturalKey = await db.getFirstAsync<LocalAttendance>(
        `SELECT * FROM attendances
         WHERE user_id = ? AND festival_id = ? AND date = ? AND _deleted = 0`,
        [att.userId, att.festivalId, att.date],
      );

      if (byNaturalKey && byNaturalKey.id !== att.id) {
        // Local record exists with a different ID — update ID to match server
        // so future API calls (delete, etc.) use the correct server ID.
        // Wrap in a transaction to avoid partial reconciliation.
        const oldId = byNaturalKey.id;
        const serverUpdatedAt = att.updatedAt ?? att.createdAt;

        await db.withTransactionAsync(async () => {
          // Update all dependent tables referencing the old local ID
          await db.runAsync(
            `UPDATE consumptions SET attendance_id = ? WHERE attendance_id = ?`,
            [att.id, oldId],
          );

          await db.runAsync(
            `UPDATE beer_pictures SET attendance_id = ? WHERE attendance_id = ?`,
            [att.id, oldId],
          );

          // Update pending sync queue entries that reference the old ID
          await db.runAsync(
            `UPDATE _sync_queue SET record_id = ? WHERE record_id = ? AND table_name = 'attendances' AND status IN ('pending', 'failed')`,
            [att.id, oldId],
          );

          // Update the attendance ID itself
          await db.runAsync(
            `UPDATE attendances SET
              id = ?, beer_count = ?, updated_at = ?, _synced_at = ?, _dirty = 0
            WHERE id = ?`,
            [att.id, att.beerCount, serverUpdatedAt, now, oldId],
          );
        });

        logger.info(
          `[SyncManager] Reconciled attendance ID: ${oldId} → ${att.id}`,
        );
        result.updated++;
      } else if (!byNaturalKey) {
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
      // If byNaturalKey exists with matching ID, it was already handled above
    }
  }
}

/**
 * Upsert tent_visits into local SQLite from the server's attendance response.
 *
 * tent_visits are immutable post-insert on the server (no update path), so
 * we only need insert-if-missing — no LWW timestamp comparison.
 *
 * visit_date is normalized to YYYY-MM-DD to match the local write path in
 * useOfflineUpdateAttendance and the UI query in useAdaptedAttendanceByDate
 * (which compares on exact date-string match). The server stores visit_date
 * as an ISO timestamp, but the local schema's
 * UNIQUE(user_id, tent_id, festival_id, visit_date) index and adapted-hook
 * query both assume "one row per tent per day".
 *
 * Ghost-row reconciliation: useOfflineUpdateAttendance writes tent_visits
 * locally with a client-generated UUID and _dirty=1. The parent attendance
 * push creates server tent_visits with different UUIDs — the local client-UUID
 * rows are never cleared because there's no direct push handler for
 * tent_visits. Also, earlier mixed-format pulls may have left rows with
 * timestamp visit_dates that are invisible to the UI. Both are cleaned up
 * here by deleting any row sharing the natural key (date-only match, or a
 * timestamp prefix-matching the date) whose id differs from the server's.
 */
async function processTentVisits(
  db: SQLite.SQLiteDatabase,
  tentVisits: ServerTentVisit[],
  result: PullResult,
  now: string,
): Promise<void> {
  for (const tv of tentVisits) {
    const visitDate = tv.visitDate.slice(0, 10);

    // Clean up any other local row with the same natural key — both ghost
    // rows (date-only visit_date, _dirty=1) and stale pulled rows from an
    // earlier mixed-format pull (timestamp visit_date starting with this date).
    await db.runAsync(
      `DELETE FROM tent_visits
       WHERE user_id = ? AND tent_id = ? AND festival_id = ?
         AND (visit_date = ? OR visit_date LIKE ?)
         AND id != ?`,
      [tv.userId, tv.tentId, tv.festivalId, visitDate, `${visitDate}%`, tv.id],
    );

    const existing = await db.getFirstAsync<LocalTentVisit>(
      "SELECT * FROM tent_visits WHERE id = ?",
      [tv.id],
    );

    if (existing) {
      await db.runAsync(
        `UPDATE tent_visits SET
          visit_date = ?, _synced_at = ?, _dirty = 0, _deleted = 0
        WHERE id = ?`,
        [visitDate, now, tv.id],
      );
      if (existing.visit_date !== visitDate || existing._dirty === 1) {
        result.updated++;
      }
    } else {
      await db.runAsync(
        `INSERT INTO tent_visits (
          id, user_id, tent_id, festival_id, visit_date,
          _synced_at, _dirty, _deleted
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
        [tv.id, tv.userId, tv.tentId, tv.festivalId, visitDate, now],
      );
      result.inserted++;
    }
  }
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
