import { WrappedDataSchema } from "@prostcounter/shared";
import { describe, expect, it } from "vitest";

import { mapToWrappedData } from "../wrapped-mapper";
import empty from "./fixtures/wrapped-data.empty.json";
import full from "./fixtures/wrapped-data.full.json";

describe("mapToWrappedData", () => {
  it("maps the full RPC shape to a schema-valid camelCase object", () => {
    const wrapped = mapToWrappedData(full);
    expect(() => WrappedDataSchema.parse(wrapped)).not.toThrow();
    expect(wrapped.basicStats.totalBeers).toBe(12.5);
    expect(wrapped.tentStats.tentBreakdown[0]).toEqual({ tentName: "Augustiner-Festhalle", visitCount: 3 });
    expect(wrapped.socialStats.topRankings).toEqual([{ groupName: "Die Durstigen", position: 1 }]);
    expect(wrapped.socialStats.pictures[0].pictureUrl).toBe("pics/a.jpg");
    expect(wrapped.comparisons.vsFestivalAvg.beersPercentile).toBe(81.3);
    expect(wrapped.comparisons.vsLastYear?.prevFestivalName).toBe("Oktoberfest 2025");
    expect(wrapped.achievements[0].unlockedAt).toBe("2026-09-19T11:00:00+00:00");
    expect(wrapped.globalLeaderboardPositions.avgBeers).toBeNull();
  });

  it("maps drink stats (the slide that never rendered)", () => {
    const wrapped = mapToWrappedData(full);
    expect(wrapped.drinkStats).toEqual({
      totalDrinks: 14,
      topDrinkType: "beer",
      breakdown: [
        { drinkType: "beer", count: 11, percentage: 78.6 },
        { drinkType: "radler", count: 3, percentage: 21.4 },
      ],
    });
  });

  it("accepts a zero-drink attendee with nulls and empty arrays", () => {
    const wrapped = mapToWrappedData(empty);
    expect(wrapped.tentStats.favoriteTent).toBeNull();
    expect(wrapped.peakMoments.bestDay).toBeNull();
    expect(wrapped.peakMoments.maxSingleSession).toBe(0);
    expect(wrapped.drinkStats.topDrinkType).toBeNull();
    expect(wrapped.comparisons.vsLastYear).toBeNull();
    expect(wrapped.userInfo.username).toBeNull();
  });

  it("drops the null traits get_wrapped_data emits for unmet CASEs", () => {
    const wrapped = mapToWrappedData({
      ...full,
      personality: { type: "Loyalist", traits: [null, "Steady Pace", null, "Tent Loyalist"] },
    });
    expect(wrapped.personality.traits).toEqual(["Steady Pace", "Tent Loyalist"]);
  });

  it("rejects a payload missing a section", () => {
    const { drink_stats: _dropped, ...partial } = full;
    expect(() => mapToWrappedData(partial)).toThrow();
  });
});
