import { describe, expect, it } from "vitest";

import { visitFallsOnDay } from "../supabase/calendar.repository";

const BERLIN = "Europe/Berlin";

describe("visitFallsOnDay", () => {
  it("matches a visit stamped at the festival day's local midnight", () => {
    // This is what save_attendance_and_tent_visits writes for a newly added
    // tent: local midnight, which in CEST is 22:00 UTC the previous day.
    // Comparing ISO prefixes read "2026-09-21" here and matched nothing, so
    // every such day lost its beer_summary event.
    expect(visitFallsOnDay("2026-09-21T22:00:00+00:00", "2026-09-22", BERLIN)).toBe(true);
  });

  it("matches a visit stamped during the evening of its own day", () => {
    expect(visitFallsOnDay("2026-09-22T16:30:00+00:00", "2026-09-22", BERLIN)).toBe(true);
  });

  it("keeps a small-hours visit on the day it belongs to", () => {
    // 00:30 CEST on the 23rd is still the 23rd, not the 22nd.
    expect(visitFallsOnDay("2026-09-22T22:30:00+00:00", "2026-09-23", BERLIN)).toBe(true);
    expect(visitFallsOnDay("2026-09-22T22:30:00+00:00", "2026-09-22", BERLIN)).toBe(false);
  });

  it("rejects a visit from a neighbouring day", () => {
    expect(visitFallsOnDay("2026-09-20T16:00:00+00:00", "2026-09-22", BERLIN)).toBe(false);
  });

  it("buckets by the festival's timezone, not UTC", () => {
    // The same instant lands on different days depending on the festival, so
    // the timezone has to come from the festival row rather than a constant.
    const instant = "2026-09-22T04:00:00+00:00";
    expect(visitFallsOnDay(instant, "2026-09-22", BERLIN)).toBe(true);
    expect(visitFallsOnDay(instant, "2026-09-21", "America/Los_Angeles")).toBe(true);
  });

  it("tolerates an attendance date that arrives as a full timestamp", () => {
    expect(visitFallsOnDay("2026-09-21T22:00:00+00:00", "2026-09-22T00:00:00+00:00", BERLIN)).toBe(
      true,
    );
  });
});
