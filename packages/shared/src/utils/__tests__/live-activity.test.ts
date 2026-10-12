import { describe, expect, it } from "vitest";

import { LiveActivityStateSchema } from "../../schemas/live-activity.schema";
import {
  buildLiveActivityState,
  drinkBreakdown,
  drinkEmoji,
  isLiveActivityStale,
  liveActivityStaleDate,
} from "../live-activity";

const visit = (tentId: string, tentName: string, visitDate: string) => ({
  tentId,
  tentName,
  visitDate,
});

describe("buildLiveActivityState", () => {
  it("returns null when the day has no drinks and no tent visits", () => {
    expect(buildLiveActivityState({ attendance: null, consumptions: [] })).toBeNull();
  });

  it("uses the newest drink for the +1 and the latest visit for the tent", () => {
    const tentA = "11111111-1111-4111-8111-111111111111";
    const tentB = "22222222-2222-4222-8222-222222222222";
    const state = buildLiveActivityState({
      attendance: {
        drinkCount: 3,
        beerCount: 2,
        tentVisits: [
          visit(tentA, "Augustiner", "2026-10-03T10:00:00+00:00"),
          visit(tentB, "Armbrust", "2026-10-03T12:00:00+00:00"),
        ],
      },
      consumptions: [
        { drinkType: "beer", tentId: tentA, recordedAt: "2026-10-03T11:00:00.000Z" },
        { drinkType: "radler", tentId: tentB, recordedAt: "2026-10-03T12:30:00.000Z" },
      ],
    });

    expect(state).toEqual({
      drinkCount: 3,
      beerCount: 2,
      tentName: "Armbrust",
      lastDrinkType: "radler",
      lastTentId: tentB,
      pendingCount: 0,
      lastLogAt: "2026-10-03T12:30:00.000Z",
      message: null,
    });
    expect(LiveActivityStateSchema.parse(state)).toEqual(state);
  });

  it("falls back to a beer in the current tent after a check-in without drinks", () => {
    const tentA = "11111111-1111-4111-8111-111111111111";
    const state = buildLiveActivityState({
      attendance: {
        drinkCount: 0,
        beerCount: 0,
        tentVisits: [visit(tentA, "Augustiner", "2026-10-03T10:00:00+00:00")],
      },
      consumptions: [],
    });

    expect(state?.lastDrinkType).toBe("beer");
    expect(state?.lastTentId).toBe(tentA);
    expect(state?.lastLogAt).toBe("2026-10-03T10:00:00.000Z");
  });

  it("ignores a date-only visit time, which reads as UTC midnight", () => {
    const tentA = "11111111-1111-4111-8111-111111111111";
    const withDrink = buildLiveActivityState({
      attendance: {
        drinkCount: 1,
        beerCount: 1,
        tentVisits: [visit(tentA, "Augustiner", "2026-10-03")],
      },
      consumptions: [{ drinkType: "beer", tentId: tentA, recordedAt: "2026-10-03T11:00:00.000Z" }],
    });
    expect(withDrink?.lastLogAt).toBe("2026-10-03T11:00:00.000Z");

    const checkInOnly = buildLiveActivityState({
      attendance: {
        drinkCount: 0,
        beerCount: 0,
        tentVisits: [visit(tentA, "Augustiner", "2026-10-03")],
      },
      consumptions: [],
      now: new Date("2026-10-03T18:00:00.000Z"),
    });
    expect(checkInOnly?.tentName).toBe("Augustiner");
    expect(checkInOnly?.lastLogAt).toBe("2026-10-03T18:00:00.000Z");
  });

  it("carries pending count and message through", () => {
    const state = buildLiveActivityState({
      attendance: { drinkCount: 1, beerCount: 1, tentVisits: [] },
      consumptions: [{ drinkType: "beer", tentId: null, recordedAt: "2026-10-03T11:00:00.000Z" }],
      pendingCount: 2,
      message: "openAppToSync",
    });

    expect(state?.pendingCount).toBe(2);
    expect(state?.message).toBe("openAppToSync");
  });
});

describe("staleness", () => {
  const state = buildLiveActivityState({
    attendance: { drinkCount: 1, beerCount: 1, tentVisits: [] },
    consumptions: [{ drinkType: "beer", tentId: null, recordedAt: "2026-10-03T11:00:00.000Z" }],
  });

  const day = { date: "2026-10-03", timezone: "Europe/Berlin" };

  it("goes stale two hours after the last log", () => {
    if (!state) {
      throw new Error("expected a state");
    }
    expect(liveActivityStaleDate(state, day)).toBe("2026-10-03T13:00:00.000Z");
    expect(isLiveActivityStale(state, day, new Date("2026-10-03T12:59:59.000Z"))).toBe(false);
    expect(isLiveActivityStale(state, day, new Date("2026-10-03T13:00:00.000Z"))).toBe(true);
  });

  it("never outlives the festival day's midnight", () => {
    if (!state) {
      throw new Error("expected a state");
    }
    const lateState = { ...state, lastLogAt: "2026-10-03T21:30:00.000Z" };
    // 23:30 in Munich: midnight comes before the two hours are up.
    expect(liveActivityStaleDate(lateState, day)).toBe("2026-10-03T22:00:00.000Z");
  });
});

describe("drinkEmoji", () => {
  it("matches the watch's mapping", () => {
    expect(drinkEmoji("beer")).toBe("🍺");
    expect(drinkEmoji("radler")).toBe("🍋");
    expect(drinkEmoji("alcohol_free")).toBe("🚫");
    expect(drinkEmoji("wine")).toBe("🍷");
    expect(drinkEmoji("soft_drink")).toBe("🥤");
    expect(drinkEmoji("other")).toBe("🥂");
  });
});

describe("drinkBreakdown", () => {
  it("splits beers from other drinks", () => {
    expect(drinkBreakdown({ drinkCount: 4, beerCount: 3 })).toBe("3 🍺 · 1 🥂");
    expect(drinkBreakdown({ drinkCount: 3, beerCount: 3 })).toBe("3 🍺");
    expect(drinkBreakdown({ drinkCount: 2, beerCount: 0 })).toBe("2 🥂");
    expect(drinkBreakdown({ drinkCount: 0, beerCount: 0 })).toBe("0 🍺");
  });
});
