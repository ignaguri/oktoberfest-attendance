import { describe, expect, it } from "vitest";

import { buildOverlapBody, formatOverlapDayLabel } from "../plan-overlap-copy";

describe("formatOverlapDayLabel", () => {
  const today = "2026-09-23";

  it("says today and tomorrow for the next two days", () => {
    expect(formatOverlapDayLabel("2026-09-23", today)).toBe("today");
    expect(formatOverlapDayLabel("2026-09-24", today)).toBe("tomorrow");
  });

  it("names the weekday up to six days ahead", () => {
    expect(formatOverlapDayLabel("2026-09-26", today)).toBe("on Saturday");
    expect(formatOverlapDayLabel("2026-09-29", today)).toBe("on Tuesday");
  });

  it("falls back to the date a week or more ahead", () => {
    expect(formatOverlapDayLabel("2026-09-30", today)).toBe("on Sep 30");
  });
});

describe("buildOverlapBody", () => {
  it("tells a plan as going too", () => {
    expect(
      buildOverlapBody({ actorName: "ana", kind: "plan", tentName: null, dayLabel: "on Saturday" }),
    ).toBe("ana is going on Saturday too");
  });

  it("names the tent for a reservation", () => {
    expect(
      buildOverlapBody({
        actorName: "ana",
        kind: "reservation",
        tentName: "Augustiner-Festhalle",
        dayLabel: "on Saturday",
      }),
    ).toBe("ana reserved Augustiner-Festhalle on Saturday");
  });

  it("falls back to going too when a reservation has no tent name", () => {
    expect(
      buildOverlapBody({
        actorName: "ana",
        kind: "reservation",
        tentName: null,
        dayLabel: "today",
      }),
    ).toBe("ana is going today too");
  });
});
