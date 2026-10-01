/**
 * Stands in for the app's tracker until it exists, then becomes it. The tracker
 * is created in an effect, and child effects run first, so a cold launch from a
 * push tap or a first-render TrackOnMount would otherwise go to the no-op
 * tracker and be lost.
 *
 * Events wait here until attach(), which replays them and from then on forwards
 * every call. Consumers keep the same object across the hand-off: components
 * that re-fire when the tracker identity changes (TrackOnScreen) would otherwise
 * send the event twice. discard() is the auth boundary: once the app knows it
 * is signed out, nothing buffered may reach whoever signs in next.
 *
 * The window and cap are backstops for an auth state that never resolves.
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
  /** Replays what was buffered into the first real tracker and forwards to it from then on. */
  attach(tracker: Tracker): void;
  /** Signed out: drops what was buffered and stops buffering for good. */
  discard(): void;
}

export function createPreTrackerBuffer(now: () => number = Date.now): PreTrackerBuffer {
  const startedAtMs = now();
  let events: BufferedEvent[] = [];
  let target: Tracker | null = null;
  let closed = false;

  function isWithinWindow(): boolean {
    return now() - startedAtMs <= PRE_TRACKER_WINDOW_MS;
  }

  return {
    track<N extends EventName>(name: N, props: EventProps<N>) {
      if (target) {
        try {
          target.track(name, props);
        } catch {
          // Tracking must never break the caller.
        }
        return;
      }
      if (closed || events.length >= PRE_TRACKER_MAX_EVENTS || !isWithinWindow()) {
        return;
      }
      events.push({ name, props });
    },
    flush(options) {
      target?.flush(options);
    },
    pause() {
      target?.pause();
    },
    resume() {
      return target?.resume() ?? NOOP_TRACKER.resume();
    },
    dispose() {
      target?.dispose();
    },
    attach(tracker: Tracker) {
      if (closed) {
        return;
      }
      closed = true;
      target = tracker;
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
    discard() {
      closed = true;
      events = [];
    },
  };
}
