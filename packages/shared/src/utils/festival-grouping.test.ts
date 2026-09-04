import { describe, expect, it } from "vitest";

import type { Festival } from "../schemas/festival.schema";
import { groupFestivalsByStatus } from "./festival-grouping";

let festivalCounter = 0;

/** Build a Festival with only the fields the grouping logic reads. */
function makeFestival(name: string, startDate: string, endDate: string): Festival {
  festivalCounter += 1;

  return {
    id: `00000000-0000-4000-8000-${festivalCounter.toString().padStart(12, "0")}`,
    name,
    startDate,
    endDate,
    beerCost: null,
    location: null,
    latitude: null,
    longitude: null,
    mapUrl: null,
    isActive: false,
    status: "ended",
    timezone: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const NOW = new Date("2026-09-04T12:00:00.000Z");

describe("groupFestivalsByStatus", () => {
  it("splits festivals into active, upcoming and past relative to now", () => {
    const active = makeFestival("Active", "2026-08-01", "2026-09-15");
    const upcoming = makeFestival("Upcoming", "2026-09-19", "2026-10-04");
    const past = makeFestival("Past", "2025-09-20", "2025-10-05");

    const result = groupFestivalsByStatus([past, upcoming, active], NOW);

    expect(result.active.map((f) => f.name)).toEqual(["Active"]);
    expect(result.upcoming.map((f) => f.name)).toEqual(["Upcoming"]);
    expect(result.past.map((f) => f.name)).toEqual(["Past"]);
  });

  it("sorts upcoming by soonest start date first", () => {
    const later = makeFestival("Later", "2026-11-01", "2026-11-10");
    const sooner = makeFestival("Sooner", "2026-09-19", "2026-10-04");

    const result = groupFestivalsByStatus([later, sooner], NOW);

    expect(result.upcoming.map((f) => f.name)).toEqual(["Sooner", "Later"]);
  });

  it("sorts past by most recently ended first", () => {
    const older = makeFestival("Older", "2024-09-21", "2024-10-06");
    const newer = makeFestival("Newer", "2025-09-20", "2025-10-05");

    const result = groupFestivalsByStatus([older, newer], NOW);

    expect(result.past.map((f) => f.name)).toEqual(["Newer", "Older"]);
  });

  it("treats the final day of a festival as active, not past", () => {
    const lastDay = makeFestival("Last Day", "2026-08-20", "2026-09-04");

    const result = groupFestivalsByStatus([lastDay], NOW);

    expect(result.active.map((f) => f.name)).toEqual(["Last Day"]);
    expect(result.past).toEqual([]);
  });

  it("returns three empty groups for an empty input", () => {
    expect(groupFestivalsByStatus([], NOW)).toEqual({
      active: [],
      upcoming: [],
      past: [],
    });
  });
});
