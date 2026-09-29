import { NOOP_TRACKER, type Tracker } from "@prostcounter/shared/analytics";
import { describe, expect, it } from "vitest";

import { isScreenEventDue, isScreenViewDue } from "../screen-events";

const trackerA: Tracker = { ...NOOP_TRACKER };
const trackerB: Tracker = { ...NOOP_TRACKER };

describe("isScreenViewDue", () => {
  it("is due for the first screen", () => {
    expect(isScreenViewDue(null, trackerA, "/home")).toBe(true);
  });

  it("is not due for the same screen under the same tracker", () => {
    expect(isScreenViewDue({ tracker: trackerA, screen: "/home" }, trackerA, "/home")).toBe(false);
  });

  it("is due for a new screen", () => {
    expect(isScreenViewDue({ tracker: trackerA, screen: "/home" }, trackerA, "/groups")).toBe(true);
  });

  it("is due for the same screen under the next user's tracker", () => {
    expect(isScreenViewDue({ tracker: trackerA, screen: "/home" }, trackerB, "/home")).toBe(true);
  });
});

describe("isScreenEventDue", () => {
  it("is not due off screen", () => {
    expect(isScreenEventDue(false, trackerA, null)).toBe(false);
  });

  it("waits for a real tracker instead of spending the visit on the no-op", () => {
    expect(isScreenEventDue(true, NOOP_TRACKER, null)).toBe(false);
  });

  it("is due on screen with a real tracker that has not seen this visit", () => {
    expect(isScreenEventDue(true, trackerA, null)).toBe(true);
  });

  it("is not due again for the same tracker during the same visit", () => {
    expect(isScreenEventDue(true, trackerA, trackerA)).toBe(false);
  });

  it("is due again when the tracker changes mid-visit", () => {
    expect(isScreenEventDue(true, trackerB, trackerA)).toBe(true);
  });
});
