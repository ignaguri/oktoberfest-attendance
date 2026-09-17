import { describe, expect, it } from "vitest";

import { resolveDayLink } from "../day-link";

const OKTOBERFEST = { id: "oktoberfest" };
const VOLKSFEST = { id: "volksfest" };
const FESTIVALS = [OKTOBERFEST, VOLKSFEST];

describe("resolveDayLink", () => {
  it("does nothing without a valid date", () => {
    expect(
      resolveDayLink({
        date: "26-09-2026",
        festivalId: undefined,
        currentFestivalId: OKTOBERFEST.id,
        festivals: FESTIVALS,
        festivalsLoading: false,
      }),
    ).toEqual({ action: "none" });
  });

  it("opens the day in the current festival when the link names none", () => {
    expect(
      resolveDayLink({
        date: "2026-09-26",
        festivalId: undefined,
        currentFestivalId: OKTOBERFEST.id,
        festivals: FESTIVALS,
        festivalsLoading: false,
      }),
    ).toEqual({ action: "open", date: "2026-09-26" });
  });

  it("opens the day when the link names the current festival", () => {
    expect(
      resolveDayLink({
        date: "2026-09-26",
        festivalId: OKTOBERFEST.id,
        currentFestivalId: OKTOBERFEST.id,
        festivals: FESTIVALS,
        festivalsLoading: false,
      }),
    ).toEqual({ action: "open", date: "2026-09-26" });
  });

  it("switches to the link's festival first", () => {
    expect(
      resolveDayLink({
        date: "2026-09-26",
        festivalId: OKTOBERFEST.id,
        currentFestivalId: VOLKSFEST.id,
        festivals: FESTIVALS,
        festivalsLoading: false,
      }),
    ).toEqual({ action: "switch", festival: OKTOBERFEST });
  });

  it("waits while festivals are still loading", () => {
    expect(
      resolveDayLink({
        date: "2026-09-26",
        festivalId: OKTOBERFEST.id,
        currentFestivalId: VOLKSFEST.id,
        festivals: [],
        festivalsLoading: true,
      }),
    ).toEqual({ action: "wait" });
  });

  it("drops a link to a festival it cannot find, rather than open the day in another", () => {
    expect(
      resolveDayLink({
        date: "2026-09-26",
        festivalId: "gone",
        currentFestivalId: VOLKSFEST.id,
        festivals: FESTIVALS,
        festivalsLoading: false,
      }),
    ).toEqual({ action: "drop" });
  });
});
