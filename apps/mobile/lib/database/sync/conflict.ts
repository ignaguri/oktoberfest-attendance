/**
 * Conflict Resolution
 *
 * Last-write-wins conflict resolution logic for sync operations.
 */

import { logger } from "@/lib/logger";

// Clock drift tolerance for last-write-wins comparison (1 second)
const CLOCK_DRIFT_TOLERANCE_MS = 1000;

/**
 * Check if a local record should be updated with server data.
 * Implements last-write-wins conflict resolution:
 * - If local has uncommitted changes (_dirty=1), compare updated_at timestamps
 * - Local wins if it was modified more recently than server
 * - Server wins otherwise
 */
export function shouldUpdate(
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
    if (localTime > serverTime + CLOCK_DRIFT_TOLERANCE_MS) {
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
  return serverTime > localSyncTime - CLOCK_DRIFT_TOLERANCE_MS;
}

/**
 * Log a sync conflict for debugging/analytics
 */
export function logConflict(
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
