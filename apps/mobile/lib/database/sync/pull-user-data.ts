/**
 * Pull User Data
 *
 * Sync operations for user-specific tables:
 * profiles, attendances, consumptions.
 */

import { formatDateForDatabase } from "@prostcounter/shared";
import type * as SQLite from "expo-sqlite";

import { logger } from "@/lib/logger";

import { apiClient } from "../../api-client";
import { clearDeletedConsumptions } from "../consumptions";
import type { LocalAttendance, LocalConsumption, LocalProfile, LocalTentVisit } from "../schema";
import { updateLastSyncAt } from "../sync-queue";
import {
  clearDeletedTentVisits,
  clearSupersededTentVisits,
  isPendingLocalRemoval,
  purgeConfirmedTentVisitTombstones,
  type TentVisitDayGroup,
} from "../tent-visits";
import { logConflict, shouldUpdate } from "./conflict";
import { pullErrorMessage } from "./errors";
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
export async function pullProfile(db: SQLite.SQLiteDatabase, userId: string): Promise<PullResult> {
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

    const existing = await db.getFirstAsync<LocalProfile>("SELECT * FROM profiles WHERE id = ?", [
      userId,
    ]);

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
    result.error = pullErrorMessage(error);
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

    // Only reconcile deletes when the response is the full festival snapshot.
    // The list endpoint is paginated (limit: 100); if we only got a partial
    // page, rows missing from the response might still live on the server.
    const isFullSnapshot = attendances.length >= response.total;

    await processAttendances(db, festivalId, attendances, attendancesResult, now, isFullSnapshot);
    await updateLastSyncAt(db, "attendances", now);

    // The day key is read in the festival's calendar, matching the server since
    // 20260811100000_bucket_tent_visits_by_festival_timezone. Previously this used
    // the app-wide default, so any festival outside Europe/Berlin filed visits
    // under a different day here than the server did.
    const festivalRow = await db.getFirstAsync<{ timezone: string | null }>(
      "SELECT timezone FROM festivals WHERE id = ?",
      [festivalId],
    );

    await processTentVisits(
      db,
      festivalId,
      response.tentVisits ?? [],
      tentVisitsResult,
      now,
      isFullSnapshot,
      festivalRow?.timezone ?? undefined,
    );
    await updateLastSyncAt(db, "tent_visits", now);
  } catch (error) {
    logger.error("[SyncManager] Pull attendances failed:", error);
    // One request feeds both results, so a throw invalidates both.
    attendancesResult.error = pullErrorMessage(error);
    tentVisitsResult.error = pullErrorMessage(error);
  }

  return [attendancesResult, tentVisitsResult];
}

async function processAttendances(
  db: SQLite.SQLiteDatabase,
  festivalId: string,
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
  isFullSnapshot: boolean,
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
          logConflict("attendances", att.id, existing.updated_at, serverUpdatedAt, "server");
        }
      } else if (existing._dirty === 1) {
        // Local wins - log the conflict
        logConflict("attendances", att.id, existing.updated_at, serverUpdatedAt, "local");
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
          await db.runAsync(`UPDATE consumptions SET attendance_id = ? WHERE attendance_id = ?`, [
            att.id,
            oldId,
          ]);

          await db.runAsync(`UPDATE beer_pictures SET attendance_id = ? WHERE attendance_id = ?`, [
            att.id,
            oldId,
          ]);

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

        logger.info(`[SyncManager] Reconciled attendance ID: ${oldId} → ${att.id}`);
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

  // Reconcile server-side deletes: any row previously synced that the server
  // no longer returns was deleted elsewhere (other device, web, admin). Mark
  // it soft-deleted so the UI drops it and the periodic cleanup can purge it.
  // Skips _dirty rows so in-flight local mutations aren't clobbered.
  // Skipped when the response was paginated/partial — we'd otherwise delete
  // rows that still exist on the server but live on another page.
  if (!isFullSnapshot) return;

  const serverIds = new Set(attendances.map((a) => a.id));
  const localRows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM attendances
     WHERE festival_id = ?
       AND _deleted = 0
       AND _dirty = 0
       AND _synced_at IS NOT NULL`,
    [festivalId],
  );
  const stale = localRows.filter((row) => !serverIds.has(row.id));
  if (stale.length > 0) {
    await db.withTransactionAsync(async () => {
      for (const row of stale) {
        await db.runAsync(
          `UPDATE attendances
           SET _deleted = 1, _synced_at = ?
           WHERE id = ?`,
          [now, row.id],
        );
        await db.runAsync(
          `UPDATE consumptions
           SET _deleted = 1, _synced_at = ?
           WHERE attendance_id = ? AND _deleted = 0`,
          [now, row.id],
        );
        result.deleted++;
      }
    });
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
 * as an ISO timestamp; created_at keeps it, and is what orders several visits
 * to the same tent within one day.
 *
 * Ghost-row reconciliation: reconcileTentVisits writes a row with a
 * client-generated UUID and _dirty=1, and the parent attendance push then
 * creates the server row under a UUID of its own, so the local one is orphaned.
 * Earlier mixed-format pulls also left rows whose visit_date is a timestamp,
 * invisible to the UI. Both are cleared per (user, tent, festival, day) group
 * once the server's own rows for that group are in place.
 *
 * The cleanup deliberately runs per group rather than per row. It used to delete
 * every row sharing the natural key with a different id, which was fine while a
 * unique index held the day to one visit per tent, but now erases the very rows
 * that make a revisit a revisit: pulling A@10:00 and A@20:00 would have had the
 * second delete the first.
 */
async function processTentVisits(
  db: SQLite.SQLiteDatabase,
  festivalId: string,
  tentVisits: ServerTentVisit[],
  result: PullResult,
  now: string,
  isFullSnapshot: boolean,
  timezone?: string,
): Promise<void> {
  const groups = new Map<string, TentVisitDayGroup>();

  for (const tv of tentVisits) {
    const visitDate = formatDateForDatabase(new Date(tv.visitDate), timezone);
    const createdAt = tv.visitDate;

    const groupKey = `${tv.userId}|${tv.tentId}|${tv.festivalId}|${visitDate}`;
    const group = groups.get(groupKey);
    if (group) {
      group.serverIds.push(tv.id);
    } else {
      groups.set(groupKey, {
        userId: tv.userId,
        tentId: tv.tentId,
        festivalId: tv.festivalId,
        visitDate,
        serverIds: [tv.id],
      });
    }

    const existing = await db.getFirstAsync<LocalTentVisit>(
      "SELECT * FROM tent_visits WHERE id = ?",
      [tv.id],
    );

    if (existing) {
      // A tombstone with _dirty set is a removal the user made here that has not
      // reached the server yet - the attendance UPDATE carrying it is still
      // queued. The server naturally still returns the row, so treating that as
      // truth would undo the removal on screen, and after the push did land the
      // server would stop returning the row, leaving the resurrected copy in a
      // group nothing pulls again. Leave it tombstoned; the purge below clears it
      // once the server confirms the removal.
      if (isPendingLocalRemoval(existing)) {
        continue;
      }

      const needsUpdate =
        existing.visit_date !== visitDate ||
        existing.created_at !== createdAt ||
        existing._dirty === 1 ||
        existing._deleted === 1 ||
        existing._synced_at === null;
      if (needsUpdate) {
        await db.runAsync(
          `UPDATE tent_visits SET
            visit_date = ?, created_at = ?, _synced_at = ?, _dirty = 0, _deleted = 0
          WHERE id = ?`,
          [visitDate, createdAt, now, tv.id],
        );
        result.updated++;
      }
    } else {
      await db.runAsync(
        `INSERT INTO tent_visits (
          id, user_id, tent_id, festival_id, visit_date, created_at,
          _synced_at, _dirty, _deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [tv.id, tv.userId, tv.tentId, tv.festivalId, visitDate, createdAt, now],
      );
      result.inserted++;
    }
  }

  // Second pass on purpose: a group's superseded rows can only be identified
  // once every server row in it has been written, or the last row pulled would
  // look like a stranger to the ones before it.
  for (const group of groups.values()) {
    result.deleted += await clearSupersededTentVisits(db, group);
  }

  // Purge the tombstones the server has acted on. A row the user removed here
  // stays tombstoned (see the skip above) until the attendance push carrying the
  // removal lands; once it has, the server stops returning that row, and this is
  // the only thing that then reaps the tombstone - the row's day-group no longer
  // appears in any pull, so clearSupersededTentVisits is never called for it.
  //
  // Only on a full snapshot: a row absent from a partial page may still exist
  // server-side, and dropping the tombstone early would hide a removal that has
  // not actually happened.
  if (!isFullSnapshot) {
    return;
  }

  const serverIds = new Set(tentVisits.map((tv) => tv.id));
  result.deleted += await purgeConfirmedTentVisitTombstones(db, festivalId, serverIds);

  // And reconcile deletes made elsewhere: a visit removed on the web or another
  // device is simply absent from the response, and nothing else would ever notice
  // - its day-group is gone, so clearSupersededTentVisits is never called for it.
  result.deleted += await clearDeletedTentVisits(db, festivalId, serverIds);
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
                logConflict("consumptions", cons.id, existing.updated_at, cons.updatedAt, "server");
              }
            } else if (existing._dirty === 1) {
              // Local wins
              logConflict("consumptions", cons.id, existing.updated_at, cons.updatedAt, "local");
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

        // Reconcile deletes made elsewhere. The response is the day's complete,
        // unpaginated set, so a local row missing from it was deleted on the web
        // or another device — and nothing else would ever notice.
        result.deleted += await clearDeletedConsumptions(
          db,
          att.id,
          new Set(consumptions.map((cons) => cons.id)),
        );
      } catch (error) {
        logger.error(`[SyncManager] Pull consumptions for ${att.date} failed:`, error);
        // Keep going for the other days, but the day we skipped means this
        // table is now incomplete — the sync must not call itself clean.
        result.error ??= pullErrorMessage(error);
      }
    }

    await updateLastSyncAt(db, "consumptions", now);
  } catch (error) {
    logger.error("[SyncManager] Pull consumptions failed:", error);
    result.error = pullErrorMessage(error);
  }

  return result;
}
