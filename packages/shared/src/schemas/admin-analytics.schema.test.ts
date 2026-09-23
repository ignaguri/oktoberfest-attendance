import { describe, expect, it } from "vitest";

import {
  AnalyticsOverviewQuerySchema,
  AnalyticsRangeQuerySchema,
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
});

describe("AnalyticsOverviewQuerySchema", () => {
  it("accepts ios and android", () => {
    expect(
      AnalyticsOverviewQuerySchema.parse({ from: "2026-09-01", to: "2026-09-30", platform: "ios" }),
    ).toEqual({ from: "2026-09-01", to: "2026-09-30", platform: "ios" });
  });

  it("rejects web", () => {
    expect(
      AnalyticsOverviewQuerySchema.safeParse({ from: "2026-09-01", to: "2026-09-30", platform: "web" })
        .success,
    ).toBe(false);
  });

  it("still validates the range", () => {
    expect(
      AnalyticsOverviewQuerySchema.safeParse({ from: "2026-09-30", to: "2026-09-01" }).success,
    ).toBe(false);
  });
});
