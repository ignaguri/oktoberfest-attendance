import { describe, expect, it } from "vitest";

import { getWrappedArchiveSummary } from "./wrapped-archive";

describe("getWrappedArchiveSummary", () => {
  it("is empty without any Wrapped", () => {
    expect(getWrappedArchiveSummary(undefined)).toBeNull();
    expect(getWrappedArchiveSummary(null)).toBeNull();
    expect(getWrappedArchiveSummary([])).toBeNull();
  });

  it("opens the only Wrapped directly", () => {
    expect(getWrappedArchiveSummary([{ festivalId: "fest-1", viewed: false }])).toEqual({
      count: 1,
      newCount: 1,
      target: { kind: "festival", festivalId: "fest-1" },
    });
  });

  it("opens the archive for two or more and counts the unviewed", () => {
    expect(
      getWrappedArchiveSummary([
        { festivalId: "fest-3", viewed: false },
        { festivalId: "fest-2", viewed: true },
        { festivalId: "fest-1", viewed: false },
      ]),
    ).toEqual({ count: 3, newCount: 2, target: { kind: "archive" } });
  });
});
