import type { PersistedUnlock } from "./types";

/** Gold. Below this a batch gets the toast alone, so heavy sessions stay quiet. */
const CONFETTI_MIN_TIER = 3;

/**
 * Adds unlocks the queue has not already seen, keyed by event id.
 *
 * The dedup is what makes the hybrid delivery safe: the same unlock can arrive
 * inline from the write that caused it and again from a later pending read, and
 * must produce exactly one toast.
 *
 * Returns the original array unchanged when nothing new arrived, so a React
 * state setter given this result does not re-render.
 */
export function mergeUnlocks(
  queue: PersistedUnlock[],
  incoming: PersistedUnlock[],
): PersistedUnlock[] {
  const seen = new Set(queue.map((entry) => entry.eventId));
  const additions: PersistedUnlock[] = [];

  for (const entry of incoming) {
    if (seen.has(entry.eventId)) {
      continue;
    }
    seen.add(entry.eventId);
    additions.push(entry);
  }

  if (additions.length === 0) {
    return queue;
  }

  return [...queue, ...additions];
}

/** True when the batch's best rung is gold or platinum. */
export function batchEarnsConfetti(batch: PersistedUnlock[]): boolean {
  return batch.some((entry) => entry.tier >= CONFETTI_MIN_TIER);
}
