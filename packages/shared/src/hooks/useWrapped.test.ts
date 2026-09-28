import { describe, expect, it } from "vitest";

import { wrappedStaleTime } from "./useWrapped";

describe("wrappedStaleTime", () => {
  it("keeps a ready Wrapped for ten minutes", () => {
    expect(wrappedStaleTime({ status: "ready" } as never)).toBe(10 * 60 * 1000);
  });

  // A locked answer goes stale at once, so reopening Wrapped after the unlock
  // refetches instead of showing a countdown that has already passed.
  it.each([
    [{ status: "locked", unlocksAt: "2026-10-04T22:00:00.000Z" }],
    [{ status: "not_attended" }],
    [undefined],
  ])("treats %o as immediately stale", (response) => {
    expect(wrappedStaleTime(response as never)).toBe(0);
  });
});
