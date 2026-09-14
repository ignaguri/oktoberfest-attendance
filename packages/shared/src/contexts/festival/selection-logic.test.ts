import { describe, expect, it } from "vitest";

import type { Festival } from "../../schemas/festival.schema";
import {
  getSwitchSuggestion,
  isFestivalLive,
  isFestivalLiveOrUpcoming,
  selectFestival,
} from "./selection-logic";

function festival(id: string, startDate: string, endDate: string, isActive = false): Festival {
  return {
    id,
    name: id,
    startDate,
    endDate,
    beerCost: null,
    location: null,
    latitude: null,
    longitude: null,
    mapUrl: null,
    isActive,
    status: "upcoming",
    timezone: "Europe/Berlin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

// Sorted by startDate desc, as the API returns them
const oktoberfest2027 = festival("oktoberfest-2027", "2027-09-18", "2027-10-03");
const oktoberfest2026 = festival("oktoberfest-2026", "2026-09-19", "2026-10-04");
const herbstfest2026 = festival("herbstfest-2026", "2026-08-29", "2026-09-13");
const volksfest2026 = festival("volksfest-2026", "2026-08-08", "2026-08-17", true);
const fruehlingsfest2026 = festival("fruehlingsfest-2026", "2026-04-17", "2026-05-10");
const festivals = [oktoberfest2027, oktoberfest2026, herbstfest2026, volksfest2026, fruehlingsfest2026];

// Noon in Munich, so UTC and Berlin agree on the date
const at = (date: string) => new Date(`${date}T10:00:00.000Z`);

describe("isFestivalLive", () => {
  it("counts the first and last day as live", () => {
    expect(isFestivalLive(oktoberfest2026, at("2026-09-19"))).toBe(true);
    expect(isFestivalLive(oktoberfest2026, at("2026-10-04"))).toBe(true);
  });

  it("is not live the day before or after", () => {
    expect(isFestivalLive(oktoberfest2026, at("2026-09-18"))).toBe(false);
    expect(isFestivalLive(oktoberfest2026, at("2026-10-05"))).toBe(false);
  });

  it("resolves the date in the festival timezone", () => {
    // 23:30 UTC on Oct 3 is already Oct 4 in Munich, the last day
    expect(isFestivalLive(oktoberfest2026, new Date("2026-10-04T23:30:00.000Z"))).toBe(false);
    expect(isFestivalLive(oktoberfest2026, new Date("2026-10-03T23:30:00.000Z"))).toBe(true);
  });
});

describe("isFestivalLiveOrUpcoming", () => {
  it("excludes ended festivals only", () => {
    const now = at("2026-09-14");
    expect(isFestivalLiveOrUpcoming(oktoberfest2026, now)).toBe(true);
    expect(isFestivalLiveOrUpcoming(herbstfest2026, now)).toBe(false);
  });
});

describe("selectFestival", () => {
  it("returns null without festivals", () => {
    expect(selectFestival([], null)).toBeNull();
  });

  it("keeps the stored selection even when another festival is live", () => {
    expect(selectFestival(festivals, fruehlingsfest2026.id, at("2026-09-20"))).toBe(
      fruehlingsfest2026,
    );
  });

  it("picks the live festival without a stored selection", () => {
    expect(selectFestival(festivals, null, at("2026-09-20"))).toBe(oktoberfest2026);
  });

  it("falls through a stored id that no longer exists", () => {
    expect(selectFestival(festivals, "deleted", at("2026-09-20"))).toBe(oktoberfest2026);
  });

  it("picks the nearest upcoming festival over an ended one flagged active", () => {
    expect(selectFestival(festivals, null, at("2026-09-14"))).toBe(oktoberfest2026);
  });

  it("falls back to the most recent festival when all have ended", () => {
    expect(selectFestival(festivals, null, at("2028-01-01"))).toBe(oktoberfest2027);
  });
});

describe("getSwitchSuggestion", () => {
  const now = at("2026-09-20");

  it("offers the live festival when the current one is not live", () => {
    expect(getSwitchSuggestion(festivals, fruehlingsfest2026, null, now)).toBe(oktoberfest2026);
  });

  it("offers nothing when the current festival is live", () => {
    expect(getSwitchSuggestion(festivals, oktoberfest2026, null, now)).toBeNull();
  });

  it("offers nothing when no festival is live", () => {
    expect(getSwitchSuggestion(festivals, fruehlingsfest2026, null, at("2026-09-14"))).toBeNull();
  });

  it("offers nothing once dismissed for that live festival", () => {
    expect(getSwitchSuggestion(festivals, fruehlingsfest2026, oktoberfest2026.id, now)).toBeNull();
  });

  it("offers again when a different festival goes live", () => {
    expect(
      getSwitchSuggestion(festivals, fruehlingsfest2026, herbstfest2026.id, now),
    ).toBe(oktoberfest2026);
  });

  it("offers nothing without a current festival", () => {
    expect(getSwitchSuggestion(festivals, null, null, now)).toBeNull();
  });
});
