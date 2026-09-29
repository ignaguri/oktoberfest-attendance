import { describe, expect, it } from "vitest";

import { initialStoryState, revealDurationMs, storyReducer } from "./navigation";

describe("storyReducer", () => {
  it("finishes the reveal before moving on", () => {
    const start = initialStoryState(3);
    const revealed = storyReducer(start, { type: "next" });
    expect(revealed).toEqual({ index: 0, total: 3, revealComplete: true });
    expect(storyReducer(revealed, { type: "next" })).toEqual({ index: 1, total: 3, revealComplete: false });
  });

  it("stays on the last slide and the first slide", () => {
    const last = { index: 2, total: 3, revealComplete: true };
    expect(storyReducer(last, { type: "next" })).toBe(last);
    const first = { index: 0, total: 3, revealComplete: true };
    expect(storyReducer(first, { type: "prev" })).toBe(first);
  });

  it("goes back to the previous slide's end frame", () => {
    expect(storyReducer({ index: 2, total: 3, revealComplete: false }, { type: "prev" })).toEqual({
      index: 1,
      total: 3,
      revealComplete: true,
    });
  });

  it("marks the reveal done once and replays from the start", () => {
    const done = storyReducer(initialStoryState(3), { type: "revealDone" });
    expect(done.revealComplete).toBe(true);
    expect(storyReducer(done, { type: "revealDone" })).toBe(done);
    expect(storyReducer({ index: 2, total: 3, revealComplete: true }, { type: "replay" })).toEqual(
      initialStoryState(3),
    );
  });

  it("times reveals from their steps", () => {
    expect(revealDurationMs(4)).toBe(4 * 350 + 400);
  });
});
