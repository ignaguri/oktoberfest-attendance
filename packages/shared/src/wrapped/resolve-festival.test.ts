import { describe, expect, it } from "vitest";

import type { WrappedFestival } from "../schemas/wrapped.schema";
import { resolveWrappedFestivalId } from "./resolve-festival";

const festival = (festivalId: string): WrappedFestival => ({
  festivalId,
  name: festivalId,
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  unlocksAt: "2026-01-02T23:00:00.000Z",
  viewed: false,
});

describe("resolveWrappedFestivalId", () => {
  it("prefers the explicit param", () => {
    expect(resolveWrappedFestivalId("p", [festival("a")], "c")).toBe("p");
  });

  it("falls back to the newest unlocked festival", () => {
    expect(resolveWrappedFestivalId(undefined, [festival("a"), festival("b")], "c")).toBe("a");
  });

  it("falls back to the current festival so its locked state can show", () => {
    expect(resolveWrappedFestivalId(undefined, [], "c")).toBe("c");
  });

  it("waits for the list instead of fetching the current festival first", () => {
    // Otherwise the current festival is fetched (and, if unlocked, marked viewed)
    // before the newest unlocked one replaces it.
    expect(resolveWrappedFestivalId(undefined, undefined, "c")).toBeUndefined();
    expect(resolveWrappedFestivalId(undefined, null, "c")).toBeUndefined();
  });
});
