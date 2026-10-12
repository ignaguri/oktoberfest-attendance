import type { LiveActivityState } from "@prostcounter/shared/schemas";
import { describe, expect, it } from "vitest";

import { mergeWithRunningState } from "../merge";

const local: LiveActivityState = {
  drinkCount: 2,
  beerCount: 2,
  tentName: "Augustiner",
  lastDrinkType: "beer",
  lastTentId: null,
  pendingCount: 0,
  lastLogAt: "2026-10-03T10:00:00.000Z",
  message: null,
};

describe("mergeWithRunningState", () => {
  it("keeps lock-screen taps the local data has not synced yet", () => {
    const running = {
      ...local,
      drinkCount: 5,
      beerCount: 4,
      lastDrinkType: "radler" as const,
      pendingCount: 1,
      lastLogAt: "2026-10-03T13:00:00.000Z",
      message: "openAppToSync" as const,
    };

    expect(mergeWithRunningState(local, running)).toEqual(running);
  });

  it("takes a newer local log but never a lower count", () => {
    const running = { ...local, drinkCount: 5, beerCount: 5, pendingCount: 1 };
    const newerLocal = {
      ...local,
      drinkCount: 3,
      lastDrinkType: "wine" as const,
      lastLogAt: "2026-10-03T14:00:00.000Z",
    };

    expect(mergeWithRunningState(newerLocal, running)).toEqual({
      ...newerLocal,
      drinkCount: 5,
      beerCount: 5,
      pendingCount: 0,
    });
  });

  it("falls back to whichever side exists", () => {
    expect(mergeWithRunningState(local, null)).toBe(local);
    expect(mergeWithRunningState(null, local)).toBe(local);
    expect(mergeWithRunningState(null, null)).toBeNull();
  });
});
