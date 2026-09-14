import { describe, expect, it } from "vitest";

import type { Festival } from "../../schemas/festival.schema";
import { resolveGroupFestivalSync } from "./useSyncFestivalWithGroup";

function festival(id: string): Festival {
  return {
    id,
    name: id,
    startDate: "2026-09-19",
    endDate: "2026-10-04",
    beerCost: null,
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

const oktoberfest = festival("oktoberfest-2026");
const fruehlingsfest = festival("fruehlingsfest-2026");
const festivals = [oktoberfest, fruehlingsfest];

describe("resolveGroupFestivalSync", () => {
  it("switches to the group's festival when it differs", () => {
    expect(
      resolveGroupFestivalSync("group-a", oktoberfest.id, fruehlingsfest, festivals, undefined),
    ).toEqual({ handled: true, switchTo: oktoberfest });
  });

  it("settles without switching when the group matches the current festival", () => {
    expect(
      resolveGroupFestivalSync("group-a", oktoberfest.id, oktoberfest, festivals, undefined),
    ).toEqual({ handled: true, switchTo: null });
  });

  it("does not switch back after the user picks another festival", () => {
    // The group screen already synced to Oktoberfest, then the user chose Frühlingsfest
    expect(
      resolveGroupFestivalSync("group-a", oktoberfest.id, fruehlingsfest, festivals, "group-a"),
    ).toEqual({ handled: false, switchTo: null });
  });

  it("waits while the group or the current festival is still loading", () => {
    expect(
      resolveGroupFestivalSync(undefined, undefined, fruehlingsfest, festivals, undefined),
    ).toEqual({ handled: false, switchTo: null });
    expect(
      resolveGroupFestivalSync("group-a", oktoberfest.id, null, festivals, undefined),
    ).toEqual({ handled: false, switchTo: null });
  });

  it("retries once festivals load instead of settling early", () => {
    expect(
      resolveGroupFestivalSync("group-a", oktoberfest.id, fruehlingsfest, [], undefined),
    ).toEqual({ handled: false, switchTo: null });
  });

  it("acts again for another group of the same festival", () => {
    // A reused route: group A was synced, the user switched away, then opened group B
    expect(
      resolveGroupFestivalSync("group-b", oktoberfest.id, fruehlingsfest, festivals, "group-a"),
    ).toEqual({ handled: true, switchTo: oktoberfest });
  });
});
