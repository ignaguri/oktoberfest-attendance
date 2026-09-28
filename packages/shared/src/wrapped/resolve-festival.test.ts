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

  it("treats an empty-string param as absent", () => {
    expect(resolveWrappedFestivalId("", [festival("a")], "c")).toBe("a");
  });

  it("returns undefined while the list is still loading and nothing else is known", () => {
    expect(resolveWrappedFestivalId(undefined, undefined, undefined)).toBeUndefined();
  });
});
