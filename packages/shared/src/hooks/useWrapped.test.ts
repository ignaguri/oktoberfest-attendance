import { describe, expect, it } from "vitest";

import { wrappedStaleTime } from "./useWrapped";

describe("wrappedStaleTime", () => {
  it("keeps a ready Wrapped for ten minutes", () => {
    expect(wrappedStaleTime({ status: "ready" } as never)).toBe(10 * 60 * 1000);
  });

  // Reopening after the unlock must refetch, not show a countdown that ended
  it("treats a locked answer as immediately stale", () => {
    expect(wrappedStaleTime({ status: "locked", unlocksAt: "2026-10-04T22:00:00.000Z" })).toBe(0);
  });
});
