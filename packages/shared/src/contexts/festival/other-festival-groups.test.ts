import { describe, expect, it } from "vitest";

import type { Festival } from "../../schemas/festival.schema";
import { getOtherFestivalGroups } from "./other-festival-groups";

function festival(id: string, startDate: string, endDate: string): Festival {
  return {
    id,
    name: id,
    startDate,
    endDate,
    beerCost: null,
    drinkPrices: {},
    location: null,
    latitude: null,
    longitude: null,
    mapUrl: null,
    isActive: false,
    status: "upcoming",
    timezone: "Europe/Berlin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const oktoberfest2027 = festival("oktoberfest-2027", "2027-09-18", "2027-10-03");
const oktoberfest2026 = festival("oktoberfest-2026", "2026-09-19", "2026-10-04");
const herbstfest2026 = festival("herbstfest-2026", "2026-08-29", "2026-09-20");
const fruehlingsfest2026 = festival("fruehlingsfest-2026", "2026-04-17", "2026-05-10");
const festivals = [oktoberfest2027, oktoberfest2026, herbstfest2026, fruehlingsfest2026];

const now = new Date("2026-09-14T10:00:00.000Z");
const group = (festivalId: string) => ({ festivalId });

describe("getOtherFestivalGroups", () => {
  it("counts groups per live or upcoming festival, soonest first", () => {
    const groups = [
      group(oktoberfest2027.id),
      group(oktoberfest2026.id),
      group(oktoberfest2026.id),
      group(herbstfest2026.id),
    ];

    expect(getOtherFestivalGroups(groups, festivals, fruehlingsfest2026.id, now)).toEqual([
      { festival: herbstfest2026, groupCount: 1 },
      { festival: oktoberfest2026, groupCount: 2 },
      { festival: oktoberfest2027, groupCount: 1 },
    ]);
  });

  it("never offers ended festivals", () => {
    const groups = [group(fruehlingsfest2026.id)];
    expect(getOtherFestivalGroups(groups, festivals, oktoberfest2026.id, now)).toEqual([]);
  });

  it("excludes the current festival", () => {
    const groups = [group(oktoberfest2026.id)];
    expect(getOtherFestivalGroups(groups, festivals, oktoberfest2026.id, now)).toEqual([]);
  });

  it("ignores groups whose festival is not in the list", () => {
    const groups = [group("unknown")];
    expect(getOtherFestivalGroups(groups, festivals, oktoberfest2026.id, now)).toEqual([]);
  });
});
