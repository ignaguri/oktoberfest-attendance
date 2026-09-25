import { describe, expect, it } from "vitest";

import type { FestivalProgress } from "../schemas/profile.schema";
import { getHeadlineLine, getProgressLines } from "./festival-progress";

const base: FestivalProgress = {
  currentStreak: 2,
  bestStreak: 3,
  tentsVisited: 7,
  tentsTotal: 17,
  photosUploaded: 4,
  previousFestival: { name: "Oktoberfest 2025", beers: 22, days: 4 },
  isSolo: true,
};

describe("getProgressLines", () => {
  it("shows streak, tents, chase and photos while under last time", () => {
    expect(getProgressLines(base, 18).map((line) => line.id)).toEqual([
      "streak",
      "tents",
      "chase",
      "photos",
    ]);
  });

  it("nudges for a first photo instead of showing 0 photos", () => {
    const photos = getProgressLines({ ...base, photosUploaded: 0 }, 18).at(-1);
    expect(photos).toMatchObject({ id: "photosNudge", key: "home.progress.photosNudge" });
  });

  it("falls back to the best streak when the current one is broken", () => {
    const lines = getProgressLines({ ...base, currentStreak: 0 }, 18);
    expect(lines[0]).toMatchObject({ id: "bestStreak", params: { count: 3 } });
  });

  it("counts the beers still needed to match last time, Radler halves included", () => {
    const chase = getProgressLines(base, 18.5).find((line) => line.id === "chase");
    expect(chase?.params).toEqual({ count: 3.5, target: 22, festivalName: "Oktoberfest 2025" });
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
    expect(lines.map((line) => line.id)).toEqual(["streak", "photos"]);
  });

  it("returns only the photo nudge when there is nothing else to show", () => {
    const lines = getProgressLines(
      {
        ...base,
        currentStreak: 0,
        bestStreak: 0,
        tentsTotal: 0,
        photosUploaded: 0,
        previousFestival: null,
      },
      0,
    );
    expect(lines.map((line) => line.id)).toEqual(["photosNudge"]);
  });
});

describe("getHeadlineLine", () => {
  it("prefers a live streak, then the target, then the photo nudge, then tents", () => {
    expect(getHeadlineLine(getProgressLines(base, 18))?.id).toBe("streak");
    expect(getHeadlineLine(getProgressLines({ ...base, currentStreak: 0 }, 18))?.id).toBe("chase");
    const noTarget = { ...base, currentStreak: 0, previousFestival: null };
    expect(getHeadlineLine(getProgressLines({ ...noTarget, photosUploaded: 0 }, 18))?.id).toBe(
      "photosNudge",
    );
    expect(getHeadlineLine(getProgressLines(noTarget, 18))?.id).toBe("tents");
    expect(getHeadlineLine(getProgressLines({ ...noTarget, tentsTotal: 0 }, 18))?.id).toBe(
      "bestStreak",
    );
  });
});
