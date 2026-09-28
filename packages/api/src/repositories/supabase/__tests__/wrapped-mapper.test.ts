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
    // The drinks slide never rendered while clients read snake_case
    expect(wrapped.drinkStats.totalDrinks).toBe(14);
    expect(wrapped.drinkStats.breakdown[1]).toEqual({ drinkType: "radler", count: 3, percentage: 21.4 });
    expect(wrapped.timing).toEqual({
      timedDays: 2,
      medianFirstHour: 12.5,
      medianLastHour: 22.75,
      peakHour: 20,
      weekendShare: 0.5,
    });
    expect(wrapped.comparisons.vsFestivalAvg.attendeeCount).toBe(64);
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
});
