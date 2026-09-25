import { describe, expect, it } from "vitest";

import type { FestivalProgress } from "../schemas/profile.schema";
import { getProgressLines } from "./festival-progress";

const base: FestivalProgress = {
  currentStreak: 2,
  bestStreak: 3,
  tentsVisited: 7,
  tentsTotal: 17,
  previousFestival: { name: "Oktoberfest 2025", beers: 22, days: 4 },
  isSolo: true,
};

describe("getProgressLines", () => {
  it("shows streak, tents and chase while under last time", () => {
    expect(getProgressLines(base, 18).map((line) => line.id)).toEqual(["streak", "tents", "chase"]);
  });

  it("falls back to the best streak when the current one is broken", () => {
    const lines = getProgressLines({ ...base, currentStreak: 0 }, 18);
    expect(lines[0]).toMatchObject({ id: "bestStreak", shortKey: null, params: { count: 3 } });
  });

  it("turns the chase into a record at or over last time", () => {
    const record = getProgressLines(base, 22).find((line) => line.id === "record");
    expect(record?.params).toEqual({ beers: 22, target: 22, festivalName: "Oktoberfest 2025" });
  });

  it("hides tents without a tent list and the chase without a usable target", () => {
    const lines = getProgressLines(
      { ...base, tentsTotal: 0, previousFestival: { name: "Oktoberfest 2025", beers: 0, days: 2 } },
      5,
    );
    expect(lines.map((line) => line.id)).toEqual(["streak"]);
  });

  it("returns nothing when there is no streak, no tents and no previous festival", () => {
    expect(
      getProgressLines(
        { ...base, currentStreak: 0, bestStreak: 0, tentsTotal: 0, previousFestival: null },
        0,
      ),
    ).toEqual([]);
  });
});
