import { describe, expect, it } from "vitest";

import type { Festival } from "../schemas/festival.schema";
import {
  getFestivalCountdown,
  getFestivalSeriesKey,
  getPreviousFestivalInSeries,
} from "./festival-countdown";

function makeFestival(overrides: Partial<Festival>): Festival {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Oktoberfest 2026",
    startDate: "2026-09-19",
    endDate: "2026-10-04",
    beerCost: null,
    drinkPrices: {},
    location: null,
    latitude: null,
    longitude: null,
    mapUrl: null,
    isActive: true,
    status: "upcoming",
    timezone: "Europe/Berlin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const oktoberfest2026 = makeFestival({});

describe("getFestivalCountdown", () => {
  it("counts down to 12:00 Berlin on the start date", () => {
    // 2026-09-16 10:00 CEST, three days and two hours before opening
    const countdown = getFestivalCountdown(oktoberfest2026, new Date("2026-09-16T08:00:00Z"));
    expect(countdown.phase).toBe("upcoming");
    expect(countdown.remaining).toEqual({ days: 3, hours: 2, minutes: 0, seconds: 0 });
    expect(countdown.isOpeningDay).toBe(false);
    expect(countdown.currentDay).toBeNull();
    expect(countdown.totalDays).toBe(16);
  });

  it("is still upcoming one second before noon on opening day", () => {
    const countdown = getFestivalCountdown(oktoberfest2026, new Date("2026-09-19T09:59:59Z"));
    expect(countdown.phase).toBe("upcoming");
    expect(countdown.remaining).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 });
    expect(countdown.isOpeningDay).toBe(true);
  });

  it("uses the Berlin date, not UTC, for opening day", () => {
    // 01:30 Berlin on 19 Sep, still 18 Sep in UTC
    const countdown = getFestivalCountdown(oktoberfest2026, new Date("2026-09-18T23:30:00Z"));
    expect(countdown.isOpeningDay).toBe(true);
  });

  it("goes live at 12:00 Berlin as day 1", () => {
    const countdown = getFestivalCountdown(oktoberfest2026, new Date("2026-09-19T10:00:00Z"));
    expect(countdown.phase).toBe("live");
    expect(countdown.remaining).toBeNull();
    expect(countdown.currentDay).toBe(1);
  });

  it("is live on the last day until midnight Berlin", () => {
    const countdown = getFestivalCountdown(oktoberfest2026, new Date("2026-10-04T21:59:59Z"));
    expect(countdown.phase).toBe("live");
    expect(countdown.currentDay).toBe(16);
  });

  it("ends at midnight Berlin after the end date", () => {
    const countdown = getFestivalCountdown(oktoberfest2026, new Date("2026-10-04T22:00:00Z"));
    expect(countdown.phase).toBe("ended");
    expect(countdown.currentDay).toBeNull();
  });

  it("falls back to Europe/Berlin when the festival has no timezone", () => {
    const countdown = getFestivalCountdown(
      makeFestival({ timezone: null }),
      new Date("2026-09-19T10:00:00Z"),
    );
    expect(countdown.phase).toBe("live");
  });
});

describe("getFestivalSeriesKey", () => {
  it("strips a trailing year and lowercases", () => {
    expect(getFestivalSeriesKey("Oktoberfest 2025")).toBe("oktoberfest");
    expect(getFestivalSeriesKey("Rosenheimer Herbstfest 2026")).toBe("rosenheimer herbstfest");
    expect(getFestivalSeriesKey("Starkbierfest")).toBe("starkbierfest");
  });
});

describe("getPreviousFestivalInSeries", () => {
  const oktoberfest2024 = makeFestival({
    id: "00000000-0000-4000-8000-000000000024",
    name: "Oktoberfest 2024",
    startDate: "2024-09-21",
    endDate: "2024-10-06",
  });
  const oktoberfest2025 = makeFestival({
    id: "00000000-0000-4000-8000-000000000025",
    name: "Oktoberfest 2025",
    startDate: "2025-09-20",
    endDate: "2025-10-05",
  });
  const herbstfest = makeFestival({
    id: "00000000-0000-4000-8000-000000000099",
    name: "Rosenheimer Herbstfest 2026",
    startDate: "2026-08-29",
    endDate: "2026-09-13",
  });

  it("returns the most recent earlier festival with the same series", () => {
    const festivals = [oktoberfest2024, herbstfest, oktoberfest2026, oktoberfest2025];
    expect(getPreviousFestivalInSeries(oktoberfest2026, festivals)?.id).toBe(oktoberfest2025.id);
  });

  it("returns null when there is no earlier festival in the series", () => {
    expect(getPreviousFestivalInSeries(oktoberfest2026, [herbstfest, oktoberfest2026])).toBeNull();
  });
});
