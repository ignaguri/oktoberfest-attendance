/**
 * In-memory usage event queue with fire-and-forget delivery.
 *
 * Nothing here may block or break the app:
 * - track() is synchronous, returns void and swallows everything.
 * - flush() starts a detached promise and returns immediately. App code never
 *   awaits it, and its failures are silent (no toast, no Sentry).
 * - A batch the API rejects gets one retry with the next flush, then it is
 *   dropped. A batch that never reached the API (offline) goes back into the
 *   queue, which MAX_QUEUE bounds.
 * - Batch building is deferred through `schedule` (idle callback on web,
 *   setTimeout(0) on mobile) so it never competes with a gesture. keepalive
 *   flushes (tab hidden / app backgrounded) run immediately instead, because
 *   the page or JS thread may be gone by the time an idle callback fires.
 *
 * Framework-free so it can be unit tested with fake timers; the React glue is
 * in ./react.tsx.
 */
import {
  EVENT_PROPS_SCHEMAS,
  type EventName,
  type EventProps,
  MAX_EVENTS_PER_BATCH,
  type TrackedEvent,
} from "./events";

export const FLUSH_AT_SIZE = 20;
export const FLUSH_INTERVAL_MS = 15_000;
export const MAX_QUEUE = 200;
export const SESSION_IDLE_MS = 30 * 60 * 1000;

export type SendEvents = (
  events: TrackedEvent[],
  options: { keepalive: boolean },
) => Promise<unknown>;

export interface TrackerDeps {
  send: SendEvents;
  createSessionId: () => string;
  now?: () => Date;
  schedule?: (run: () => void) => void;
}

export interface Tracker {
  track<N extends EventName>(name: N, props: EventProps<N>): void;
  flush(options?: { keepalive?: boolean }): void;
  /** App backgrounded / tab hidden: remember when, and flush with keepalive. */
  pause(): void;
  /** App foregrounded / tab visible. Returns true when a new session started. */
  resume(): boolean;
  /** Signed out or unmounted: drop everything and stop the timer. */
  dispose(): void;
}

export const NOOP_TRACKER: Tracker = {
  track() {},
  flush() {},
  pause() {},
  resume() {
    return false;
  },
  dispose() {},
};

/**
 * The API answered with an error status (the client throws an ApiError with a
 * numeric statusCode). Only these count against a batch's single retry; a
 * network failure says nothing about the events, so they wait in the queue.
 */
function isServerRejection(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  );
}

export function createTracker(deps: TrackerDeps): Tracker & { queueSize(): number } {
  const now = deps.now ?? (() => new Date());
  const schedule =
    deps.schedule ??
    ((run: () => void) => {
      setTimeout(run, 0);
    });

  let queue: TrackedEvent[] = [];
  // Events from rejected batches, waiting for their single retry.
  let retryBatch: TrackedEvent[] = [];
  let sessionId = deps.createSessionId();
  let pausedAtMs: number | null = null;
  // A normal flush waiting for its idle slot. A keepalive flush clears it and
  // sends right away, since the page may be gone before the slot arrives.
  let flushScheduled = false;
  // Sends not yet settled. Normal flushes wait for zero; keepalive flushes
  // never wait, so what queued behind an in-flight send still goes out.
  let pendingSends = 0;
  let disposed = false;

  const intervalId = setInterval(() => {
    flush();
  }, FLUSH_INTERVAL_MS);

  function sendBatch(keepalive: boolean) {
    const retrying = retryBatch.slice(0, MAX_EVENTS_PER_BATCH);
    retryBatch = retryBatch.slice(MAX_EVENTS_PER_BATCH);
    const fresh = queue.splice(0, Math.max(0, MAX_EVENTS_PER_BATCH - retrying.length));
    const batch = [...retrying, ...fresh];
    if (batch.length === 0) {
      return;
    }
    pendingSends++;
    // Called synchronously so a keepalive send starts before the page goes
    // away; a synchronous throw becomes a rejection like any network failure.
    let pending: Promise<unknown>;
    try {
      pending = Promise.resolve(deps.send(batch, { keepalive }));
    } catch (error) {
      pending = Promise.reject(error);
    }
    pending
      .catch((error: unknown) => {
        if (!isServerRejection(error)) {
          // Never reached the API (offline, no session yet): nothing was
          // judged, so put the batch back and let MAX_QUEUE bound it.
          queue = [...batch, ...queue];
          if (queue.length > MAX_QUEUE) {
            queue = queue.slice(queue.length - MAX_QUEUE);
          }
          return;
        }
        // `retrying` has now failed twice and is dropped; `fresh` gets its one
        // retry. Appended, since a keepalive send can fail alongside another.
        retryBatch = [...retryBatch, ...fresh];
      })
      .finally(() => {
        pendingSends--;
      });
  }

  function flush(options: { keepalive?: boolean } = {}) {
    try {
      if (disposed) {
        return;
      }
      if (queue.length === 0 && retryBatch.length === 0) {
        return;
      }
      if (options.keepalive) {
        flushScheduled = false;
        sendBatch(true);
        return;
      }
      if (flushScheduled || pendingSends > 0) {
        return;
      }
      flushScheduled = true;
      schedule(() => {
        if (!flushScheduled || disposed) {
          return;
        }
        flushScheduled = false;
        try {
          sendBatch(false);
        } catch {
          // Tracking must never break the caller.
        }
      });
    } catch {
      flushScheduled = false;
    }
  }

  function track<N extends EventName>(name: N, props: EventProps<N>) {
    try {
      if (disposed) {
        return;
      }
      if (!EVENT_PROPS_SCHEMAS[name].safeParse(props).success) {
        return;
      }
      queue.push({
        name,
        props: props as Record<string, unknown>,
        occurredAt: now().toISOString(),
        sessionId,
      });
      if (queue.length > MAX_QUEUE) {
        queue = queue.slice(queue.length - MAX_QUEUE);
      }
      if (queue.length >= FLUSH_AT_SIZE) {
        flush();
      }
    } catch {
      // Tracking must never break the caller.
    }
  }

  return {
    track,
    flush,
    pause() {
      pausedAtMs = now().getTime();
      flush({ keepalive: true });
    },
    resume() {
      const pausedFor = pausedAtMs === null ? 0 : now().getTime() - pausedAtMs;
      pausedAtMs = null;
      if (pausedFor >= SESSION_IDLE_MS) {
        sessionId = deps.createSessionId();
        return true;
      }
      return false;
    },
    dispose() {
      disposed = true;
      clearInterval(intervalId);
      queue = [];
      retryBatch = [];
    },
    queueSize() {
      return queue.length;
    },
  };
}
