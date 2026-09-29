import { beforeAll, describe, expect, it } from "vitest";

import { initI18n } from "../i18n/core";
import type {
  AnalyticsCohortRow,
  AnalyticsFestivalRetentionRow,
} from "../schemas/admin-analytics.schema";
import {
  COHORT_SERIES,
  cohortChartRows,
  formatChartDayTick,
  formatChartMonthTick,
  formatChartValue,
  formatCohortReadout,
  OVERVIEW_SERIES,
  overviewChartRows,
  readoutIndex,
  RETENTION_SERIES,
  retentionChartRows,
  shortFestivalLabel,
  toggleSeries,
  xTickIndices,
} from "./analytics-charts";

function festival(
  overrides: Partial<AnalyticsFestivalRetentionRow>,
): AnalyticsFestivalRetentionRow {
  return {
    festivalId: "f",
    festivalName: "Oktoberfest 2024",
    startDate: "2024-09-21",
    attendees: 10,
    returnedNext: 4,
    returnedAny: 6,
    ...overrides,
  };
}

function cohort(overrides: Partial<AnalyticsCohortRow>): AnalyticsCohortRow {
  return {
    month: "2026-09-01",
    signups: 12,
    activated: 6,
    activated7d: 5,
    engaged: 3,
    returned: 1,
    ...overrides,
  };
}

describe("series definitions", () => {
  it("name the overview lines with the existing overview keys", () => {
    expect(OVERVIEW_SERIES.map((series) => series.key)).toEqual(["dau", "wau", "mau"]);
    expect(OVERVIEW_SERIES.map((series) => series.labelKey)).toEqual([
      "admin.analytics.overview.dau",
      "admin.analytics.overview.wau",
      "admin.analytics.overview.mau",
    ]);
    expect(OVERVIEW_SERIES.every((series) => series.format === "count")).toBe(true);
  });

  it("draw retention and cohorts as percentages", () => {
    expect(RETENTION_SERIES.map((series) => series.key)).toEqual(["returnedNext", "returnedAny"]);
    expect(COHORT_SERIES.map((series) => series.key)).toEqual(["activated", "engaged", "returned"]);
    expect(
      [...RETENTION_SERIES, ...COHORT_SERIES].every((series) => series.format === "percent"),
    ).toBe(true);
  });
});

describe("overviewChartRows", () => {
  it("keeps the API order and uses the day as x", () => {
    expect(
      overviewChartRows([
        { day: "2026-09-20", dau: 1, wau: 2, mau: 3 },
        { day: "2026-09-21", dau: 4, wau: 5, mau: 6 },
      ]),
    ).toEqual([
      { x: "2026-09-20", dau: 1, wau: 2, mau: 3 },
      { x: "2026-09-21", dau: 4, wau: 5, mau: 6 },
    ]);
  });

  it("is empty for an empty series", () => {
    expect(overviewChartRows([])).toEqual([]);
  });
});

describe("retentionChartRows", () => {
  it("orders festivals oldest first without mutating the input", () => {
    const input = [
      festival({ festivalId: "b", festivalName: "Oktoberfest 2025", startDate: "2025-09-20" }),
      festival({ festivalId: "a", festivalName: "Oktoberfest 2024", startDate: "2024-09-21" }),
    ];
    const rows = retentionChartRows(input);
    expect(rows.map((row) => row.festivalId)).toEqual(["a", "b"]);
    expect(input.map((row) => row.festivalId)).toEqual(["b", "a"]);
  });

  it("turns counts into rates and uses the festival name as x", () => {
    expect(retentionChartRows([festival({})])).toEqual([
      {
        x: "Oktoberfest 2024",
        festivalId: "f",
        attendees: 10,
        returnedNext: 0.4,
        returnedAny: 0.6,
      },
    ]);
  });

  it("leaves a pending festival's next-festival rate null, not 0", () => {
    const [row] = retentionChartRows([festival({ returnedNext: null })]);
    expect(row?.returnedNext).toBeNull();
    expect(row?.returnedAny).toBe(0.6);
  });

  it("gives a festival without attendees null rates", () => {
    const [row] = retentionChartRows([festival({ attendees: 0, returnedNext: 0, returnedAny: 0 })]);
    expect(row?.returnedNext).toBeNull();
    expect(row?.returnedAny).toBeNull();
  });
});

describe("cohortChartRows", () => {
  it("orders months oldest first, keyed YYYY-MM, without mutating the input", () => {
    const input = [cohort({ month: "2026-09-01" }), cohort({ month: "2026-07-01" })];
    const rows = cohortChartRows(input);
    expect(rows.map((row) => row.x)).toEqual(["2026-07", "2026-09"]);
    expect(input.map((row) => row.month)).toEqual(["2026-09-01", "2026-07-01"]);
  });

  it("keeps rates and counts side by side", () => {
    expect(cohortChartRows([cohort({})])).toEqual([
      {
        x: "2026-09",
        signups: 12,
        activated: 0.5,
        engaged: 0.25,
        returned: 1 / 12,
        counts: { activated: 6, engaged: 3, returned: 1 },
      },
    ]);
  });

  it("gives a month without signups null rates instead of dividing by zero", () => {
    const [row] = cohortChartRows([
      cohort({ signups: 0, activated: 0, activated7d: 0, engaged: 0, returned: 0 }),
    ]);
    expect(row?.activated).toBeNull();
    expect(row?.engaged).toBeNull();
    expect(row?.returned).toBeNull();
  });
});

describe("readoutIndex", () => {
  it("shows the latest point at rest", () => {
    expect(readoutIndex(5, null)).toBe(4);
  });

  it("follows the pressed point", () => {
    expect(readoutIndex(5, 2)).toBe(2);
  });

  it("clamps an out-of-range press", () => {
    expect(readoutIndex(5, 9)).toBe(4);
    expect(readoutIndex(5, -1)).toBe(0);
  });

  it("has nothing to show without rows", () => {
    expect(readoutIndex(0, null)).toBeNull();
    expect(readoutIndex(0, 3)).toBeNull();
  });
});

describe("xTickIndices", () => {
  it("has no ticks without rows", () => {
    expect(xTickIndices(0, 5)).toEqual([]);
  });

  it("labels a single point", () => {
    expect(xTickIndices(1, 5)).toEqual([0]);
  });

  it("labels every point when they fit", () => {
    expect(xTickIndices(2, 5)).toEqual([0, 1]);
    expect(xTickIndices(5, 5)).toEqual([0, 1, 2, 3, 4]);
  });

  it("spreads the ticks evenly, always keeping the first and last", () => {
    expect(xTickIndices(30, 5)).toEqual([0, 7, 15, 22, 29]);
    expect(xTickIndices(7, 4)).toEqual([0, 2, 4, 6]);
  });

  it("never repeats an index", () => {
    const ticks = xTickIndices(6, 5);
    expect(new Set(ticks).size).toBe(ticks.length);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(5);
  });
});

describe("toggleSeries", () => {
  const all = ["dau", "wau", "mau"] as const;

  it("hides a visible series", () => {
    expect(toggleSeries(["dau", "wau", "mau"], "wau", all)).toEqual(["dau", "mau"]);
  });

  it("shows a hidden series in definition order", () => {
    expect(toggleSeries(["mau"], "dau", all)).toEqual(["dau", "mau"]);
  });

  it("never hides the last visible series", () => {
    expect(toggleSeries(["mau"], "mau", all)).toEqual(["mau"]);
  });
});

describe("formatChartValue", () => {
  it("shows counts as whole numbers", () => {
    expect(formatChartValue(12, "count")).toBe("12");
    expect(formatChartValue(12.6, "count")).toBe("13");
  });

  it("shows rates as percentages", () => {
    expect(formatChartValue(0.42, "percent")).toBe("42%");
  });

  it("shows a dash for a missing value", () => {
    expect(formatChartValue(null, "percent")).toBe("—");
    expect(formatChartValue(null, "count")).toBe("—");
  });
});

describe("formatCohortReadout", () => {
  it("puts the rate next to the count out of signups", () => {
    expect(formatCohortReadout(5 / 12, 5, 12)).toBe("42% · 5/12");
  });

  it("keeps an empty month readable", () => {
    expect(formatCohortReadout(null, 0, 0)).toBe("— · 0/0");
  });
});

describe("axis labels", () => {
  beforeAll(() => {
    initI18n();
  });

  it("shows a day as month and day, on the calendar day given", () => {
    expect(formatChartDayTick("2026-09-20")).toBe("Sep 20");
    expect(formatChartDayTick("2026-01-01")).toBe("Jan 1");
  });

  it("shows a month as short month and year", () => {
    expect(formatChartMonthTick("2026-09")).toBe("Sep 26");
    expect(formatChartMonthTick("2026-09-01")).toBe("Sep 26");
  });

  it("shortens a festival name with a year", () => {
    expect(shortFestivalLabel("Oktoberfest 2024")).toBe("Okto '24");
    expect(shortFestivalLabel("Frühlingsfest 2025")).toBe("Früh '25");
  });

  it("keeps a bare year and cuts a name without one", () => {
    expect(shortFestivalLabel("2024")).toBe("2024");
    expect(shortFestivalLabel("Starkbierfest")).toBe("Starkbie");
  });
});
