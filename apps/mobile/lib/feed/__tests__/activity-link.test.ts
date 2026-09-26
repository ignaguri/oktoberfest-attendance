import { describe, expect, it } from "vitest";

import { achievementSlugFromName, getActivityLink } from "../activity-link";

const noGroups = new Set<string>();

describe("achievementSlugFromName", () => {
  it("reads the slug out of the name key", () => {
    expect(achievementSlugFromName("achievements.drinks_total.t2.name")).toBe("drinks_total.t2");
    expect(achievementSlugFromName("achievements.early_bird.name")).toBe("early_bird");
  });

  it("gives up on anything else", () => {
    expect(achievementSlugFromName("Early Bird")).toBeUndefined();
    expect(achievementSlugFromName(undefined)).toBeUndefined();
  });
});

describe("getActivityLink", () => {
  it("opens the achievement highlighted, or the plain list without a slug", () => {
    expect(
      getActivityLink(
        {
          activity_type: "achievement_unlock",
          activity_data: { achievement_name: "achievements.drinks_total.t2.name" },
        },
        noGroups,
      ),
    ).toEqual({ pathname: "/achievements", params: { highlight: "drinks_total.t2" } });
    expect(
      getActivityLink(
        { activity_type: "achievement_unlock", activity_data: { achievement_name: "Legacy" } },
        noGroups,
      ),
    ).toBe("/achievements");
  });

  it("opens a group only for its members", () => {
    const activity = { activity_type: "group_join", activity_data: { group_id: "g1" } };
    expect(getActivityLink(activity, new Set(["g1"]))).toBe("/group-detail/g1");
    expect(getActivityLink(activity, noGroups)).toBeNull();
  });

  it("opens the map on the tent for drinks, check-ins and reservations", () => {
    for (const activity_type of ["beer_count_update", "tent_checkin", "tent_reservation"]) {
      expect(getActivityLink({ activity_type, activity_data: { tent_id: "t1" } }, noGroups)).toEqual(
        { pathname: "/map", params: { tentId: "t1" } },
      );
    }
    expect(
      getActivityLink({ activity_type: "beer_count_update", activity_data: {} }, noGroups),
    ).toBeNull();
  });

  it("opens the earliest planned day", () => {
    expect(
      getActivityLink(
        { activity_type: "day_plan", activity_data: { dates: ["2026-09-28", "2026-09-26"] } },
        noGroups,
      ),
    ).toEqual({ pathname: "/attendance", params: { date: "2026-09-26" } });
    expect(
      getActivityLink({ activity_type: "day_plan", activity_data: { dates: [] } }, noGroups),
    ).toBeNull();
  });

  it("leaves photos and unknown types alone", () => {
    expect(
      getActivityLink({ activity_type: "photo_upload", activity_data: { picture_id: "p" } }, noGroups),
    ).toBeNull();
    expect(getActivityLink({ activity_type: "something_new", activity_data: null }, noGroups)).toBeNull();
  });
});
