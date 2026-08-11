/**
 * Local consumptions row management: dropping the rows a pull has superseded.
 *
 * The consumption pull only ever inserted rows the server returned and updated
 * the ones it already had — nothing removed a local row the server had stopped
 * returning (sync/pull-user-data.ts pullConsumptions). Both of its siblings do
 * reconcile deletes: processAttendances soft-deletes and processTentVisits calls
 * clearDeletedTentVisits. So a drink deleted on the web or another device stayed
 * on this device permanently, and because every count and every total is a JOIN
 * over local consumptions (adapted-hooks.ts), the day over-reported drinks and
 * money with nothing to correct it.
 *
 * Raw SQL in its own module rather than inline in the pull so the statements run
 * against a real SQLite database in tests — the mobile vitest config only
 * collects `__tests__` directories under `lib`, and importing the pull drags in
 * react-native, which vitest cannot parse. Same reasoning as ./tent-visits.
 */

import type { SQLiteBindParams } from "expo-sqlite";

/** Minimal surface of expo-sqlite's database that this reconciliation needs. */
export interface ConsumptionsDb {
  getAllAsync<T>(sql: string, params: SQLiteBindParams): Promise<T[]>;
  runAsync(sql: string, params: SQLiteBindParams): Promise<unknown>;
}

/**
 * Delete the day's local consumptions that the server no longer holds. Returns
 * how many rows went.
 *
 * `serverIds` must be the complete set for this attendance. The consumption list
 * endpoint returns one unpaginated array per day, so a caller that passes what
 * it received is passing the whole day — unlike attendances and tent visits,
 * whose responses can be partial and whose sweeps are gated on a full snapshot.
 *
 * Rows still carrying local work are left alone:
 *
 * - `_dirty = 1` is a drink logged or edited here that has not pushed yet. A
 *   sync pulls before it pushes, so on the cycle that first carries a new drink
 *   the server legitimately does not have it yet; sweeping on absence would
 *   delete the user's drink moments after they logged it.
 * - `_synced_at IS NULL` has never round-tripped, so its absence server-side
 *   says nothing.
 * - A pending, processing or failed queue entry means a push may still land.
 *   `_dirty` normally covers this, but a row whose flag was cleared while its
 *   operation is still queued must not be swept from under it.
 */
export async function clearDeletedConsumptions(
  db: ConsumptionsDb,
  attendanceId: string,
  serverIds: Set<string>,
): Promise<number> {
  const localRows = await db.getAllAsync<{ id: string }>(
    `SELECT c.id AS id
       FROM consumptions c
       LEFT JOIN _sync_queue q
         ON q.table_name = 'consumptions'
        AND q.record_id = c.id
        AND q.status IN ('pending', 'processing', 'failed')
      WHERE c.attendance_id = ?
        AND c._dirty = 0
        AND c._synced_at IS NOT NULL
        AND q.id IS NULL`,
    [attendanceId],
  );

  const stale = localRows.filter((row) => !serverIds.has(row.id));
  if (stale.length === 0) {
    return 0;
  }

  const placeholders = stale.map(() => "?").join(", ");
  const result = await db.runAsync(
    `DELETE FROM consumptions WHERE id IN (${placeholders})`,
    stale.map((row) => row.id),
  );

  return getChanges(result);
}

/** expo-sqlite returns a result object; older shims returned nothing useful. */
function getChanges(result: unknown): number {
  if (typeof result === "object" && result !== null && "changes" in result) {
    const { changes } = result as { changes: unknown };
    return typeof changes === "number" ? changes : 0;
  }
  return 0;
}
