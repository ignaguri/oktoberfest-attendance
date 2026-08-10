/**
 * Local tent_visits reconciliation for the attendance form's tent selector.
 *
 * The local write path used to only ever ADD rows, so deselecting a tent left
 * it on screen: the pull only iterates the tent visits the server returned, and
 * never deletes a local row the server has stopped returning (see
 * sync/pull-user-data.ts processTentVisits), so a stale row survived forever.
 *
 * Raw SQL in its own module rather than inline in useOfflineUpdateAttendance so
 * that the statements run against a real SQLite database in tests — the mobile
 * vitest config only collects `__tests__` directories under `lib`, so a hook is
 * not reachable from the suite. Same reasoning as ./day-summaries.
 */

import type { SQLiteBindParams } from "expo-sqlite";

/** Minimal surface of expo-sqlite's database that this reconciliation needs. */
export interface TentVisitsDb {
  getAllAsync<T>(sql: string, params: SQLiteBindParams): Promise<T[]>;
  runAsync(sql: string, params: SQLiteBindParams): Promise<unknown>;
}

export interface ReconcileTentVisitsParams {
  userId: string;
  festivalId: string;
  /**
   * YYYY-MM-DD. Compared to visit_date as a plain string, matching the UI reads
   * in adapted-hooks.ts and day-summaries.ts and the normalization the pull
   * applies when writing (sync/pull-user-data.ts).
   */
  date: string;
  /** The selection to reconcile the day to. An empty array clears the day. */
  tentIds: string[];
  /** ISO timestamp stamped on newly written rows. */
  now: string;
  /** Supplies ids for newly written rows. */
  generateId: () => string;
}

export interface ReconcileTentVisitsResult {
  tentsAdded: string[];
  tentsRemoved: string[];
}

/**
 * Bring the day's local tent_visits in line with `tentIds`, and report what
 * actually changed.
 *
 * Removals are hard deletes, not `_deleted` tombstones: there is no push
 * handler for tent_visits, so a tombstone would never reach the server. The
 * server-side removal travels with the attendance UPDATE operation's `tents`
 * array instead (see sync/push-handlers.ts). If that push never lands, the next
 * pull re-inserts the row from the server, so the local delete is self-healing
 * rather than a source of divergence.
 *
 * Tents that are already visible are left untouched. Rewriting them would reset
 * `created_at` to now and lose the real visit time the UI displays.
 */
export async function reconcileTentVisits(
  db: TentVisitsDb,
  params: ReconcileTentVisitsParams,
): Promise<ReconcileTentVisitsResult> {
  const { userId, festivalId, date, tentIds, now, generateId } = params;

  const visibleRows = await db.getAllAsync<{ tent_id: string }>(
    `SELECT tent_id FROM tent_visits
     WHERE user_id = ? AND festival_id = ? AND visit_date = ? AND _deleted = 0`,
    [userId, festivalId, date],
  );

  const selected = new Set(tentIds);
  const present = new Set(visibleRows.map((row) => row.tent_id));

  const tentsRemoved = [...present].filter((tentId) => !selected.has(tentId));
  const tentsAdded = [...selected].filter((tentId) => !present.has(tentId));

  if (tentsRemoved.length > 0) {
    const placeholders = tentsRemoved.map(() => "?").join(", ");
    await db.runAsync(
      `DELETE FROM tent_visits
       WHERE user_id = ? AND festival_id = ? AND visit_date = ?
         AND tent_id IN (${placeholders})`,
      [userId, festivalId, date, ...tentsRemoved],
    );
  }

  for (const tentId of tentsAdded) {
    // INSERT OR REPLACE with a COALESCE'd id: a soft-deleted row for this tent
    // still occupies UNIQUE(user_id, tent_id, festival_id, visit_date), so
    // reuse its id and revive it rather than hitting a constraint error.
    await db.runAsync(
      `INSERT OR REPLACE INTO tent_visits (
        id, user_id, tent_id, festival_id, visit_date, created_at,
        _synced_at, _deleted, _dirty
      ) VALUES (
        COALESCE(
          (SELECT id FROM tent_visits WHERE user_id = ? AND tent_id = ? AND festival_id = ? AND visit_date = ?),
          ?
        ),
        ?, ?, ?, ?, ?, NULL, 0, 1
      )`,
      [userId, tentId, festivalId, date, generateId(), userId, tentId, festivalId, date, now],
    );
  }

  return { tentsAdded, tentsRemoved };
}
