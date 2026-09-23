import { describe, expect, it } from "vitest";

import {
  festivalRangeKey,
  formatPercent,
  funnelConversion,
  rangeForPreset,
  resolveAnalyticsRange,
  retentionRates,
  summarizeOverview,
  visibleFestivalRetentionRows,
  withFeatureReach,
} from "./analytics-metrics";

const TODAY = new Date("2026-09-23T15:00:00Z");

describe("rangeForPreset", () => {
  it("ends today and includes today in the day count", () => {
    expect(rangeForPreset("7d", TODAY)).toEqual({ from: "2026-09-17", to: "2026-09-23" });
    expect(rangeForPreset("30d", TODAY)).toEqual({ from: "2026-08-25", to: "2026-09-23" });
  });

  it("crosses year boundaries", () => {
    expect(rangeForPreset("365d", TODAY)).toEqual({ from: "2025-09-24", to: "2026-09-23" });
  });
});

describe("resolveAnalyticsRange", () => {
  const festivals = [{ id: "f1", startDate: "2026-08-01", endDate: "2026-08-10" }];

  it("uses the festival's dates for a festival key", () => {
    expect(resolveAnalyticsRange(festivalRangeKey("f1"), festivals, TODAY)).toEqual({
      from: "2026-08-01",
      to: "2026-08-10",
    });
  });

  it("uses the preset for a preset key", () => {
    expect(resolveAnalyticsRange("7d", festivals, TODAY)).toEqual({
      from: "2026-09-17",
      to: "2026-09-23",
    });
  });

  it("falls back to 30 days for an unknown festival or key", () => {
    const fallback = { from: "2026-08-25", to: "2026-09-23" };
    expect(resolveAnalyticsRange(festivalRangeKey("missing"), festivals, TODAY)).toEqual(fallback);
    expect(resolveAnalyticsRange(festivalRangeKey("f1"), null, TODAY)).toEqual(fallback);
    expect(resolveAnalyticsRange("nonsense", festivals, TODAY)).toEqual(fallback);
  });

  it("clamps `to` to today for a festival that is ongoing", () => {
    // Started 2026-09-19 and ends 2026-10-04; today is 2026-09-23.
    const ongoing = [{ id: "ongoing", startDate: "2026-09-19", endDate: "2026-10-04" }];
    expect(resolveAnalyticsRange(festivalRangeKey("ongoing"), ongoing, TODAY)).toEqual({
      from: "2026-09-19",
      to: "2026-09-23",
    });
  });

  it("clamps `to` to today when the festival starts exactly today", () => {
    const startsToday = [{ id: "f2", startDate: "2026-09-23", endDate: "2026-09-30" }];
    expect(resolveAnalyticsRange(festivalRangeKey("f2"), startsToday, TODAY)).toEqual({
      from: "2026-09-23",
      to: "2026-09-23",
    });
  });

  it("keeps the full range for a festival that is fully in the past", () => {
    const past = [{ id: "f3", startDate: "2026-08-01", endDate: "2026-08-10" }];
    expect(resolveAnalyticsRange(festivalRangeKey("f3"), past, TODAY)).toEqual({
      from: "2026-08-01",
      to: "2026-08-10",
    });
  });

  it("keeps the full range for a festival that has not started yet", () => {
    const future = [{ id: "f4", startDate: "2026-10-01", endDate: "2026-10-10" }];
    expect(resolveAnalyticsRange(festivalRangeKey("f4"), future, TODAY)).toEqual({
      from: "2026-10-01",
      to: "2026-10-10",
    });
  });
});

describe("summarizeOverview", () => {
  it("returns zeros and no stickiness for an empty series", () => {
    expect(summarizeOverview([])).toEqual({ dau: 0, wau: 0, mau: 0, stickiness: null });
  });

  it("takes the last day's counts and averages dau/mau over days with users", () => {
    expect(
      summarizeOverview([
        { day: "2026-09-21", dau: 0, wau: 0, mau: 0 },
        { day: "2026-09-22", dau: 2, wau: 4, mau: 8 },
        { day: "2026-09-23", dau: 4, wau: 5, mau: 8 },
      ]),
    ).toEqual({ dau: 4, wau: 5, mau: 8, stickiness: 0.375 });
  });
});

describe("withFeatureReach", () => {
  const rows = [
    { feature: "attendance" as const, users: 50, events: 120 },
    { feature: "photos" as const, users: 4, events: 9 },
  ];

  it("computes reach and flags features under 5%", () => {
    expect(withFeatureReach(rows, 100)).toEqual([
      { feature: "attendance", users: 50, events: 120, reach: 0.5, isDead: false },
      { feature: "photos", users: 4, events: 9, reach: 0.04, isDead: true },
    ]);
  });

  it("has no reach and flags nothing without active users", () => {
    expect(withFeatureReach(rows, 0).map((row) => [row.reach, row.isDead])).toEqual([
      [null, false],
      [null, false],
    ]);
  });
});

describe("funnelConversion", () => {
  it("computes conversion from the first and the previous step", () => {
    expect(
      funnelConversion([
        { step: "signed_up", users: 10 },
        { step: "logged_attendance", users: 5 },
        { step: "five_days", users: 1 },
      ]),
    ).toEqual([
      { step: "signed_up", users: 10, fromStart: 1, fromPrevious: null },
      { step: "logged_attendance", users: 5, fromStart: 0.5, fromPrevious: 0.5 },
      { step: "five_days", users: 1, fromStart: 0.1, fromPrevious: 0.2 },
    ]);
  });

  it("returns null rates when nobody signed up", () => {
    expect(
      funnelConversion([
        { step: "signed_up", users: 0 },
        { step: "logged_attendance", users: 0 },
      ]),
    ).toEqual([
      { step: "signed_up", users: 0, fromStart: null, fromPrevious: null },
      { step: "logged_attendance", users: 0, fromStart: null, fromPrevious: null },
    ]);
  });
});

describe("retentionRates", () => {
  const base = { festivalId: "f", festivalName: "F", startDate: "2026-09-19" };

  it("divides by attendees", () => {
    expect(
      retentionRates({ ...base, attendees: 4, returnedNext: 1, returnedAny: 2 }),
    ).toEqual({ next: 0.25, any: 0.5 });
  });

  it("keeps next pending when the next festival has not started", () => {
    expect(
      retentionRates({ ...base, attendees: 4, returnedNext: null, returnedAny: 0 }),
    ).toEqual({ next: null, any: 0 });
  });

  it("has no rates without attendees", () => {
    expect(
      retentionRates({ ...base, attendees: 0, returnedNext: 0, returnedAny: 0 }),
    ).toEqual({ next: null, any: null });
  });
});

describe("visibleFestivalRetentionRows", () => {
  const base = { festivalId: "f", festivalName: "F", startDate: "2026-09-19" };

  it("drops festivals nobody has attended yet", () => {
    const rows = [
      { ...base, festivalId: "past", attendees: 3, returnedNext: 1, returnedAny: 1 },
      { ...base, festivalId: "upcoming", attendees: 0, returnedNext: null, returnedAny: 0 },
    ];
    expect(visibleFestivalRetentionRows(rows).map((row) => row.festivalId)).toEqual(["past"]);
  });

  it("returns an empty list when every festival has zero attendees", () => {
    const rows = [{ ...base, festivalId: "upcoming", attendees: 0, returnedNext: null, returnedAny: 0 }];
    expect(visibleFestivalRetentionRows(rows)).toEqual([]);
  });
});

describe("formatPercent", () => {
  it("rounds to a whole percent", () => {
    expect(formatPercent(0.375)).toBe("38%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
  });

  it("renders a dash for null", () => {
    expect(formatPercent(null)).toBe("—");
  });
});
