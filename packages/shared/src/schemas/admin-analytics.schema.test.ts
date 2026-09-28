import { describe, expect, it } from "vitest";

import {
  ANALYTICS_FEATURES,
  ANALYTICS_SCORECARD_FEATURES,
  ANALYTICS_SCORECARD_SEGMENTS,
  AnalyticsCohortMembersQuerySchema,
  AnalyticsFunnelMembersQuerySchema,
  AnalyticsRangeQuerySchema,
  AnalyticsScorecardMembersQuerySchema,
  AnalyticsScorecardQuerySchema,
  AnalyticsTimelineQuerySchema,
  AnalyticsUserIdParamSchema,
  analyticsRangeError,
} from "./admin-analytics.schema";

describe("analyticsRangeError", () => {
  it("accepts a single day", () => {
    expect(analyticsRangeError("2026-09-01", "2026-09-01")).toBeNull();
  });

  it("accepts exactly 400 days", () => {
    expect(analyticsRangeError("2025-08-20", "2026-09-23")).toBeNull();
  });

  it("rejects 401 days", () => {
    expect(analyticsRangeError("2025-08-19", "2026-09-23")).toMatch(/400/);
  });

  it("rejects from after to", () => {
    expect(analyticsRangeError("2026-09-02", "2026-09-01")).toMatch(/after/);
  });

  it("rejects a calendar-invalid `from` date instead of rolling it over", () => {
    // Date.parse rolls 2026-02-30 over to 2026-03-02 instead of NaN.
    expect(analyticsRangeError("2026-02-30", "2026-09-01")).toMatch(/Invalid date/);
  });

  it("rejects a calendar-invalid `to` date instead of rolling it over", () => {
    expect(analyticsRangeError("2026-09-01", "2026-02-30")).toMatch(/Invalid date/);
  });
});

describe("AnalyticsRangeQuerySchema", () => {
  it("parses a valid range", () => {
    expect(AnalyticsRangeQuerySchema.parse({ from: "2026-09-01", to: "2026-09-30" })).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("rejects a non-ISO date", () => {
    expect(AnalyticsRangeQuerySchema.safeParse({ from: "01/09/2026", to: "2026-09-30" }).success).toBe(
      false,
    );
  });

  it("rejects a missing bound", () => {
    expect(AnalyticsRangeQuerySchema.safeParse({ from: "2026-09-01" }).success).toBe(false);
  });

  it("rejects an inverted range", () => {
    expect(AnalyticsRangeQuerySchema.safeParse({ from: "2026-09-30", to: "2026-09-01" }).success).toBe(
      false,
    );
  });

  it("accepts an ios or android platform", () => {
    expect(
      AnalyticsRangeQuerySchema.parse({ from: "2026-09-01", to: "2026-09-30", platform: "ios" }),
    ).toEqual({ from: "2026-09-01", to: "2026-09-30", platform: "ios" });
  });

  it("rejects web", () => {
    expect(
      AnalyticsRangeQuerySchema.safeParse({ from: "2026-09-01", to: "2026-09-30", platform: "web" })
        .success,
    ).toBe(false);
  });
});

describe("AnalyticsScorecardQuerySchema", () => {
  it("accepts no festival", () => {
    expect(AnalyticsScorecardQuerySchema.safeParse({}).success).toBe(true);
  });

  it("accepts a festival uuid", () => {
    expect(
      AnalyticsScorecardQuerySchema.safeParse({
        festivalId: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(true);
  });

  it("rejects a festival id that is not a uuid", () => {
    expect(AnalyticsScorecardQuerySchema.safeParse({ festivalId: "okto" }).success).toBe(false);
  });
});

describe("ANALYTICS_SCORECARD_FEATURES", () => {
  it("is every v0 feature except attendance", () => {
    expect([...ANALYTICS_SCORECARD_FEATURES]).toEqual(
      ANALYTICS_FEATURES.filter((feature) => feature !== "attendance"),
    );
  });
});

describe("drill-down schemas", () => {
  it("accepts a funnel members query and rejects an unknown step", () => {
    expect(
      AnalyticsFunnelMembersQuerySchema.safeParse({
        from: "2026-09-01",
        to: "2026-09-30",
        step: "five_days",
      }).success,
    ).toBe(true);
    expect(
      AnalyticsFunnelMembersQuerySchema.safeParse({
        from: "2026-09-01",
        to: "2026-09-30",
        step: "ten_days",
      }).success,
    ).toBe(false);
  });

  it("rejects an inverted funnel members range", () => {
    expect(
      AnalyticsFunnelMembersQuerySchema.safeParse({
        from: "2026-09-30",
        to: "2026-09-01",
        step: "signed_up",
      }).success,
    ).toBe(false);
  });

  it("accepts every scorecard segment and rejects an unknown one", () => {
    for (const segment of ANALYTICS_SCORECARD_SEGMENTS) {
      expect(
        AnalyticsScorecardMembersQuerySchema.safeParse({ feature: "photos", segment }).success,
      ).toBe(true);
    }
    expect(
      AnalyticsScorecardMembersQuerySchema.safeParse({ feature: "photos", segment: "fans" })
        .success,
    ).toBe(false);
  });

  it("accepts only the first day of a month as a cohort month", () => {
    expect(
      AnalyticsCohortMembersQuerySchema.safeParse({ month: "2026-09-01", step: "engaged" }).success,
    ).toBe(true);
    expect(
      AnalyticsCohortMembersQuerySchema.safeParse({ month: "2026-09-15", step: "engaged" }).success,
    ).toBe(false);
    expect(
      AnalyticsCohortMembersQuerySchema.safeParse({ month: "2026-13-01", step: "engaged" }).success,
    ).toBe(false);
  });

  it("accepts a PostgREST timestamp as cursorAt", () => {
    const parsed = AnalyticsTimelineQuerySchema.safeParse({
      cursorAt: "2026-09-28T10:00:00.123456+00:00",
      cursorKey: "event:12",
    });
    expect(parsed.success).toBe(true);
    // Passed through verbatim: microseconds must survive
    expect(parsed.data?.cursorAt).toBe("2026-09-28T10:00:00.123456+00:00");
  });

  it("requires cursorAt and cursorKey together", () => {
    expect(AnalyticsTimelineQuerySchema.safeParse({ cursorKey: "event:12" }).success).toBe(false);
    expect(
      AnalyticsTimelineQuerySchema.safeParse({ cursorAt: "2026-09-28T10:00:00+00:00" }).success,
    ).toBe(false);
    expect(AnalyticsTimelineQuerySchema.safeParse({}).success).toBe(true);
  });

  it("coerces limit from the query string and bounds it", () => {
    expect(AnalyticsTimelineQuerySchema.parse({ limit: "50" }).limit).toBe(50);
    expect(AnalyticsTimelineQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(AnalyticsTimelineQuerySchema.safeParse({ limit: "201" }).success).toBe(false);
  });

  it("requires a uuid user id", () => {
    expect(AnalyticsUserIdParamSchema.safeParse({ userId: "nope" }).success).toBe(false);
    expect(
      AnalyticsUserIdParamSchema.safeParse({ userId: "11111111-1111-4111-8111-111111111111" })
        .success,
    ).toBe(true);
  });
});
