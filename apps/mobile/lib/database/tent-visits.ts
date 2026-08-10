/**
 * Local tent_visits row management: reconciling the attendance form's tent
 * selector, and clearing the rows a pull has superseded.
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
  /**
   * The selection to reconcile the day to. An empty array clears the day, so a
   * caller that has not learned the day's tents yet must not reach here at all.
   */
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

/** One (user, tent, festival, day) worth of tent visits the server returned. */
export interface TentVisitDayGroup {
  userId: string;
  tentId: string;
  festivalId: string;
  /** YYYY-MM-DD. */
  visitDate: string;
  /** Ids the server holds for this group. Never empty. */
  serverIds: string[];
}

/**
 * Delete the local rows in one day-group that the server's rows have replaced,
 * and only those.
 *
 * What must survive is the point of being this specific. A second visit to the
 * same tent that day is an ordinary row sharing the group's natural key, and so
 * is a visit logged offline that has not pushed yet. The old rule deleted every
 * row in the group whose id differed from the server's, which was safe only while
 * a unique index held each day to one visit per tent.
 *
 * Two kinds go:
 *
 * - Ghosts. reconcileTentVisits writes a row with a client id and _dirty = 1, and
 *   the attendance push then creates the server row under an id of its own,
 *   orphaning the local one. Recognised by never having synced and having no
 *   tent_visits operation queued: nothing is going to push it. A row the queue
 *   still references has not been materialized server-side yet, so it stays.
 *   Visits logged through logTentVisit are not affected either way, since the
 *   server honours the id the client supplies and they come back as themselves.
 * - Legacy rows. Pulled before visit_date was normalized to the day, so they
 *   carry a server id but a timestamp visit_date that no UI query can see. Only
 *   the ones the server has stopped returning are dropped; the rest were
 *   rewritten by the caller's upsert.
 */
export async function clearSupersededTentVisits(
  db: TentVisitsDb,
  group: TentVisitDayGroup,
): Promise<number> {
  const serverIdPlaceholders = group.serverIds.map(() => "?").join(", ");

  const result = await db.runAsync(
    `DELETE FROM tent_visits
     WHERE user_id = ? AND tent_id = ? AND festival_id = ?
       AND (visit_date = ? OR visit_date LIKE ?)
       AND id NOT IN (${serverIdPlaceholders})
       AND (
         (
           _synced_at IS NULL
           AND id NOT IN (
             SELECT record_id FROM _sync_queue
             WHERE table_name = 'tent_visits' AND status IN ('pending', 'failed')
           )
         )
         OR (_synced_at IS NOT NULL AND visit_date != ?)
       )`,
    [
      group.userId,
      group.tentId,
      group.festivalId,
      group.visitDate,
      `${group.visitDate}%`,
      ...group.serverIds,
      group.visitDate,
    ],
  );

  return getChanges(result);
}

/**
 * Bring the day's local tent_visits in line with `tentIds`, and report what
 * actually changed.
 *
 * Removals are `_deleted` tombstones rather than hard deletes, even though no
 * push handler for tent_visits carries a delete: the server-side removal travels
 * with the attendance UPDATE operation's `tents` array instead (see
 * sync/push-handlers.ts). The tombstone is what makes the removal survive until
 * that push lands. A hard delete did not, because a sync pulls before it pushes
 * (sync/sync-manager.ts) and the app-foreground sync only pulls: the pull found
 * the row still on the server, re-inserted it as synced, and the removal was
 * undone on screen. Worse, once the push did land the server stopped returning
 * that row, so nothing ever formed a day-group for it again and
 * clearSupersededTentVisits could no longer reach the resurrected copy - the
 * tent stayed visible on the phone forever.
 *
 * processTentVisits skips a row tombstoned this way, and purges the tombstone
 * once the server confirms the removal by no longer returning it.
 *
 * Tents that are already visible are left untouched. Rewriting them would reset
 * `created_at` to now and lose the real visit time the UI displays.
 */
export async function reconcileTentVisits(
  db: TentVisitsDb,
  params: ReconcileTentVisitsParams,
): Promise<ReconcileTentVisitsResult> {
  const { userId, festivalId, date, tentIds, now, generateId } = params;

  const visibleRows = await db.getAllAsync<{ id: string; tent_id: string }>(
    `SELECT id, tent_id FROM tent_visits
     WHERE user_id = ? AND festival_id = ? AND visit_date = ? AND _deleted = 0`,
    [userId, festivalId, date],
  );

  const selected = new Set(tentIds);
  const present = new Set(visibleRows.map((row) => row.tent_id));

  const tentsRemoved = [...present].filter((tentId) => !selected.has(tentId));
  const tentsAdded = [...selected].filter((tentId) => !present.has(tentId));

  if (tentsRemoved.length > 0) {
    const removedIds = visibleRows
      .filter((row) => !selected.has(row.tent_id))
      .map((row) => row.id);
    const idPlaceholders = removedIds.map(() => "?").join(", ");

    // Every visit to a removed tent that day, not just the latest: the day can
    // hold several, and deselecting the tent means none of them belong to it any
    // more. _dirty marks the tombstone as carrying an unpushed intention, which
    // is what tells the pull to leave it alone.
    await db.runAsync(
      `UPDATE tent_visits
       SET _deleted = 1, _dirty = 1
       WHERE id IN (${idPlaceholders})`,
      removedIds,
    );

    // Drop any queued push for those rows. A visit logged through
    // useOfflineLogTentVisit carries its own tent_visits INSERT operation, and
    // that operation does not know the user has since removed the tent: left in
    // place it would create the row on the server after the attendance UPDATE
    // had removed it, and a failed op is worse still because retryFailed revives
    // it on every later push. The row would then exist server-side while staying
    // tombstoned here.
    await db.runAsync(
      `DELETE FROM _sync_queue
       WHERE table_name = 'tent_visits'
         AND status IN ('pending', 'failed')
         AND record_id IN (${idPlaceholders})`,
      removedIds,
    );
  }

  for (const tentId of tentsAdded) {
    // Revive a soft-deleted row for this tent rather than inserting alongside it.
    // Nothing forces this any more now that the unique index is gone (migration
    // v2 -> v3), but keeping the id stable matters: the pull matches a pending
    // local row to the server row it became by (natural key, created_at), and a
    // second tombstoned row sharing that key would be a needless near-miss.
    const revived = await db.runAsync(
      `UPDATE tent_visits
       SET created_at = ?, _synced_at = NULL, _deleted = 0, _dirty = 1
       WHERE id = (
         SELECT id FROM tent_visits
         WHERE user_id = ? AND tent_id = ? AND festival_id = ? AND visit_date = ?
           AND _deleted = 1
         ORDER BY created_at DESC
         LIMIT 1
       )`,
      [now, userId, tentId, festivalId, date],
    );

    if (getChanges(revived) > 0) {
      continue;
    }

    await db.runAsync(
      `INSERT INTO tent_visits (
        id, user_id, tent_id, festival_id, visit_date, created_at,
        _synced_at, _deleted, _dirty
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, 1)`,
      [generateId(), userId, tentId, festivalId, date, now],
    );
  }

  return { tentsAdded, tentsRemoved };
}

/**
 * Whether a local row carries a removal that has not reached the server yet.
 *
 * The pull must leave these alone. The removal travels on the queued attendance
 * UPDATE, so until that pushes the server still returns the row, and writing the
 * server's version over the tombstone undoes the user's removal on screen.
 *
 * `_dirty` is what separates the two kinds of tombstone: set means the user made
 * this removal here, clear means a previous pull recorded a removal that had
 * already happened server-side, and for that one the server is authoritative.
 */
export function isPendingLocalRemoval(row: { _deleted: number; _dirty: number }): boolean {
  return row._deleted === 1 && row._dirty === 1;
}

/**
 * Drop the tombstones the server has confirmed, and report how many went.
 *
 * A tombstone stops being needed the moment the server stops returning its row:
 * that is the removal having landed. Nothing else can reap it - once the row is
 * gone server-side, no pull forms a day-group for it, so clearSupersededTentVisits
 * is never called for that group again and the tombstone would sit there forever.
 *
 * `serverIds` must come from a full snapshot. A row missing from a partial page
 * may still exist on the server, and clearing the tombstone then would hide a
 * removal that has not actually happened.
 */
export async function purgeConfirmedTentVisitTombstones(
  db: TentVisitsDb,
  festivalId: string,
  serverIds: Set<string>,
): Promise<number> {
  const tombstones = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM tent_visits
     WHERE festival_id = ? AND _deleted = 1 AND _dirty = 1`,
    [festivalId],
  );

  const confirmed = tombstones.filter((row) => !serverIds.has(row.id));
  if (confirmed.length === 0) {
    return 0;
  }

  const placeholders = confirmed.map(() => "?").join(", ");
  const result = await db.runAsync(
    `DELETE FROM tent_visits WHERE id IN (${placeholders})`,
    confirmed.map((row) => row.id),
  );

  return getChanges(result);
}

/**
 * Rows affected by a write.
 *
 * expo-sqlite resolves runAsync to a result carrying `changes`, and so does the
 * better-sqlite3 harness the tests run against, but TentVisitsDb intentionally
 * types it as unknown so the interface stays minimal. Anything else counts as
 * zero, which falls back to inserting - the safe direction, since a missed revive
 * writes a row while a wrongly assumed one would silently drop the visit.
 */
function getChanges(result: unknown): number {
  if (typeof result === "object" && result !== null && "changes" in result) {
    const { changes } = result as { changes: unknown };
    return typeof changes === "number" ? changes : 0;
  }
  return 0;
}
