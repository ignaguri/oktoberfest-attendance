import { describe, expect, it, vi } from "vitest";

import {
  createPreTrackerBuffer,
  PRE_TRACKER_MAX_EVENTS,
  PRE_TRACKER_WINDOW_MS,
} from "./pre-tracker-buffer";
import { NOOP_TRACKER, type Tracker } from "./tracker";

function fakeTracker(): Tracker {
  return { ...NOOP_TRACKER, track: vi.fn() };
}

function clockAt(startMs: number) {
  let nowMs = startMs;
  return {
    now: () => nowMs,
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

describe("createPreTrackerBuffer", () => {
  it("hands events tracked before the tracker existed to it, in order", () => {
    const clock = clockAt(0);
    const buffer = createPreTrackerBuffer(clock.now);
    buffer.track("app_opened", { source: "cold" });
    buffer.track("screen_viewed", { screen: "/" });

    const tracker = fakeTracker();
    buffer.drainInto(tracker);

    expect(tracker.track).toHaveBeenNthCalledWith(1, "app_opened", { source: "cold" });
    expect(tracker.track).toHaveBeenNthCalledWith(2, "screen_viewed", { screen: "/" });
  });

  it("keeps only the first events past the cap", () => {
    const clock = clockAt(0);
    const buffer = createPreTrackerBuffer(clock.now);
    for (let i = 0; i < PRE_TRACKER_MAX_EVENTS + 5; i++) {
      buffer.track("screen_viewed", { screen: `/${i}` });
    }

    const tracker = fakeTracker();
    buffer.drainInto(tracker);

    expect(tracker.track).toHaveBeenCalledTimes(PRE_TRACKER_MAX_EVENTS);
    expect(tracker.track).toHaveBeenLastCalledWith("screen_viewed", {
      screen: `/${PRE_TRACKER_MAX_EVENTS - 1}`,
    });
  });

  it("drops everything when the tracker arrives after the launch window", () => {
    // A signed-out launch: whoever signs in later must not get these events
    const clock = clockAt(0);
    const buffer = createPreTrackerBuffer(clock.now);
    buffer.track("screen_viewed", { screen: "/sign-in" });
    clock.advance(PRE_TRACKER_WINDOW_MS + 1);

    const tracker = fakeTracker();
    buffer.drainInto(tracker);

    expect(tracker.track).not.toHaveBeenCalled();
  });

  it("ignores events after the launch window", () => {
    const clock = clockAt(0);
    const buffer = createPreTrackerBuffer(clock.now);
    clock.advance(PRE_TRACKER_WINDOW_MS + 1);
    buffer.track("screen_viewed", { screen: "/sign-in" });
    clock.advance(-PRE_TRACKER_WINDOW_MS);

    const tracker = fakeTracker();
    buffer.drainInto(tracker);

    expect(tracker.track).not.toHaveBeenCalled();
  });

  it("hands off only once, and buffers nothing after it", () => {
    const clock = clockAt(0);
    const buffer = createPreTrackerBuffer(clock.now);
    buffer.track("app_opened", { source: "cold" });

    const first = fakeTracker();
    buffer.drainInto(first);
    // Signed out and back in: the next tracker starts clean
    buffer.track("screen_viewed", { screen: "/sign-in" });
    const second = fakeTracker();
    buffer.drainInto(second);

    expect(first.track).toHaveBeenCalledTimes(1);
    expect(second.track).not.toHaveBeenCalled();
  });

  it("never throws from track, even when the tracker does", () => {
    const clock = clockAt(0);
    const buffer = createPreTrackerBuffer(clock.now);
    buffer.track("app_opened", { source: "cold" });
    const tracker: Tracker = {
      ...NOOP_TRACKER,
      track: () => {
        throw new Error("boom");
      },
    };

    expect(() => buffer.drainInto(tracker)).not.toThrow();
  });
});
