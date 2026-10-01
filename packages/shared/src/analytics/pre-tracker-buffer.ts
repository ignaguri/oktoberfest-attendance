/**
 * Holds events tracked before the app's tracker exists, and hands them to it
 * once it does. The tracker is created in an effect, and child effects run
 * first, so a cold launch from a push tap or a first-render TrackOnMount would
 * otherwise go to the no-op tracker and be lost.
 *
 * Only the first seconds after launch are kept, and only for the first tracker.
 * A signed-out launch cannot sign in that fast, so nothing tracked before
 * sign-in is ever attributed to the account that signs in.
 *
 * Replayed events are stamped when handed off, at most the window late.
 */
import type { EventName, EventProps } from "./events";
import { NOOP_TRACKER, type Tracker } from "./tracker";

export const PRE_TRACKER_MAX_EVENTS = 20;
export const PRE_TRACKER_WINDOW_MS = 10_000;

interface BufferedEvent {
  name: EventName;
  props: unknown;
}

export interface PreTrackerBuffer extends Tracker {
  /** Replays what was buffered into the first real tracker, then stops buffering. */
  drainInto(tracker: Tracker): void;
}

export function createPreTrackerBuffer(now: () => number = Date.now): PreTrackerBuffer {
  const startedAtMs = now();
  let events: BufferedEvent[] = [];
  let closed = false;

  function isWithinWindow(): boolean {
    return now() - startedAtMs <= PRE_TRACKER_WINDOW_MS;
  }

  return {
    ...NOOP_TRACKER,
    track<N extends EventName>(name: N, props: EventProps<N>) {
      if (closed || events.length >= PRE_TRACKER_MAX_EVENTS || !isWithinWindow()) {
        return;
      }
      events.push({ name, props });
    },
    drainInto(tracker: Tracker) {
      if (closed) {
        return;
      }
      closed = true;
      const pending = isWithinWindow() ? events : [];
      events = [];
      for (const event of pending) {
        try {
          tracker.track(event.name, event.props as EventProps<typeof event.name>);
        } catch {
          // Tracking must never break the caller.
        }
      }
    },
  };
}
