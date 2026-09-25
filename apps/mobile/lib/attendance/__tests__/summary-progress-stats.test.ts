import type { FestivalProgress } from "@prostcounter/shared/schemas";
import { describe, expect, it } from "vitest";

import { getSummaryProgressStats } from "../summary-progress-stats";

const progress: FestivalProgress = {
  currentStreak: 2,
  bestStreak: 3,
  tentsVisited: 2,
  tentsTotal: 14,
  photosUploaded: 1,
  previousFestival: null,
  isSolo: false,
};

describe("getSummaryProgressStats", () => {
  it("shows streak, tents and photos as summary stats", () => {
    expect(getSummaryProgressStats({ progress, phase: "live" })).toEqual({
      streak: { value: 2, labelKey: "attendance.summary.streak" },
      tents: "2/14",
      photos: 1,
    });
  });

  it("falls back to the best streak once the streak is broken", () => {
    expect(
      getSummaryProgressStats({ progress: { ...progress, currentStreak: 0 }, phase: "ended" })
        ?.streak,
    ).toEqual({ value: 3, labelKey: "attendance.summary.bestStreak" });
  });

  it("leaves solo users to the Home card while the festival is live", () => {
    expect(
      getSummaryProgressStats({ progress: { ...progress, isSolo: true }, phase: "live" }),
    ).toBeNull();
  });

  it("shows solo users their stats once the festival is over, since Home hides its card", () => {
    expect(
      getSummaryProgressStats({ progress: { ...progress, isSolo: true }, phase: "ended" }),
    ).not.toBeNull();
  });
});
