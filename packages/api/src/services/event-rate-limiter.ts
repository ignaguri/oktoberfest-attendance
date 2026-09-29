/**
 * Per-user cap on recorded events, per API instance. There is no shared
 * rate-limit infrastructure in the API; this only has to stop a runaway client
 * loop from filling analytics.events, so an in-memory fixed window is enough.
 * Excess events are dropped silently.
 */
export const EVENTS_PER_USER_PER_MINUTE = 300;
const PRUNE_ABOVE_ENTRIES = 5_000;

export function createEventRateLimiter(limit = EVENTS_PER_USER_PER_MINUTE, windowMs = 60_000) {
  const windows = new Map<string, { startMs: number; count: number }>();

  function prune(nowMs: number) {
    for (const [userId, window] of windows) {
      if (nowMs - window.startMs >= windowMs) {
        windows.delete(userId);
      }
    }
  }

  return {
    /** How many of `requested` events this user may still record right now. */
    take(userId: string, requested: number, nowMs: number): number {
      let window = windows.get(userId);
      if (!window || nowMs - window.startMs >= windowMs) {
        window = { startMs: nowMs, count: 0 };
        windows.set(userId, window);
      }
      const allowed = Math.max(0, Math.min(requested, limit - window.count));
      window.count += allowed;
      if (windows.size > PRUNE_ABOVE_ENTRIES) {
        prune(nowMs);
      }
      return allowed;
    },
  };
}

export const eventRateLimiter = createEventRateLimiter();
