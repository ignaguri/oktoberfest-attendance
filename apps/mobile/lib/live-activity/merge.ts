import type { LiveActivityState } from "@prostcounter/shared/schemas";

/**
 * Combines today's local data with what the running surface shows. Lock-screen
 * taps reach the server directly and only land in local SQLite on the next sync,
 * so the surface can be ahead; local data must never roll it back.
 */
export function mergeWithRunningState(
  local: LiveActivityState | null,
  running: LiveActivityState | null,
): LiveActivityState | null {
  if (!running) {
    return local;
  }
  if (!local) {
    return running;
  }
  const localIsNewer = Date.parse(local.lastLogAt) > Date.parse(running.lastLogAt);
  const newer = localIsNewer ? local : running;
  return {
    ...newer,
    drinkCount: Math.max(local.drinkCount, running.drinkCount),
    beerCount: Math.max(local.beerCount, running.beerCount),
    pendingCount: localIsNewer ? local.pendingCount : running.pendingCount,
    message: localIsNewer ? local.message : running.message,
  };
}
