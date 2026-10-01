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
    buffer.attach(tracker);

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
    buffer.attach(tracker);

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
    buffer.attach(tracker);

    expect(tracker.track).not.toHaveBeenCalled();
  });

  it("ignores events after the launch window", () => {
    const clock = clockAt(0);
    const buffer = createPreTrackerBuffer(clock.now);
    clock.advance(PRE_TRACKER_WINDOW_MS + 1);
    buffer.track("screen_viewed", { screen: "/sign-in" });
    clock.advance(-PRE_TRACKER_WINDOW_MS);

    const tracker = fakeTracker();
    buffer.attach(tracker);

    expect(tracker.track).not.toHaveBeenCalled();
  });

  it("forwards to the tracker after the hand-off, past the window", () => {
    const clock = clockAt(0);
    const buffer = createPreTrackerBuffer(clock.now);
    const tracker = fakeTracker();
    buffer.attach(tracker);
    clock.advance(PRE_TRACKER_WINDOW_MS * 10);

    buffer.track("screen_viewed", { screen: "/" });

    expect(tracker.track).toHaveBeenCalledWith("screen_viewed", { screen: "/" });
  });

  it("attaches only the first tracker", () => {
    const clock = clockAt(0);
    const buffer = createPreTrackerBuffer(clock.now);
    const first = fakeTracker();
    const second = fakeTracker();
    buffer.attach(first);
    buffer.attach(second);

    buffer.track("app_opened", { source: "cold" });

    expect(first.track).toHaveBeenCalledTimes(1);
    expect(second.track).not.toHaveBeenCalled();
  });

  it("drops what it buffered once discarded, and buffers nothing after", () => {
    // Auth resolved to signed out: a fast sign-in must not get these events
    const clock = clockAt(0);
    const buffer = createPreTrackerBuffer(clock.now);
    buffer.track("screen_viewed", { screen: "/sign-in" });
    buffer.discard();
    buffer.track("screen_viewed", { screen: "/sign-up" });

    const tracker = fakeTracker();
    buffer.attach(tracker);

    expect(tracker.track).not.toHaveBeenCalled();
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

    expect(() => buffer.attach(tracker)).not.toThrow();
  });
});
