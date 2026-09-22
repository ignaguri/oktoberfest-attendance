import { describe, expect, it } from "vitest";

import { ProfileDayRowSchema, ProfileDetailSchema } from "./profile-detail.schema";

describe("ProfileDetailSchema", () => {
  const base = {
    id: "8f1f9f5e-0d3a-4c2e-9a1b-2c3d4e5f6a7b",
    username: "hans",
    fullName: "Hans Meier",
    avatarUrl: "hans.png",
    stats: null,
    friendshipStatus: null,
    friendsSince: null,
    sharedGroups: [],
    favouriteTent: null,
    history: [],
  };

  it("accepts a stranger's view, where every gated field is empty", () => {
    expect(ProfileDetailSchema.parse(base)).toEqual(base);
  });

  it("accepts a full payload", () => {
    const full = {
      ...base,
      stats: { daysAttended: 3, totalBeers: 12, avgBeers: 4 },
      friendshipStatus: "friends" as const,
      friendsSince: "2026-09-01T10:00:00.000Z",
      sharedGroups: [{ id: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed", name: "Wiesn Crew" }],
      favouriteTent: { name: "Hofbräu-Festzelt", visits: 4 },
      history: [
        {
          festivalId: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bee",
          festivalName: "Oktoberfest 2026",
          daysAttended: 3,
          totalBeers: 12,
          avgBeers: 4,
        },
      ],
    };

    expect(ProfileDetailSchema.parse(full)).toEqual(full);
  });

  it("rejects a shared group without a name", () => {
    const bad = { ...base, sharedGroups: [{ id: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed" }] };

    expect(() => ProfileDetailSchema.parse(bad)).toThrow();
  });

  it("rejects a negative visit count on the favourite tent", () => {
    const bad = { ...base, favouriteTent: { name: "Käfer", visits: -1 } };

    expect(() => ProfileDetailSchema.parse(bad)).toThrow();
  });
});

describe("ProfileDayRowSchema", () => {
  it("accepts a day with no tents", () => {
    const row = { date: "2026-09-21", totalDrinks: 0, tents: [] };

    expect(ProfileDayRowSchema.parse(row)).toEqual(row);
  });

  it("rejects a fractional drink count", () => {
    expect(() =>
      ProfileDayRowSchema.parse({ date: "2026-09-21", totalDrinks: 1.5, tents: [] }),
    ).toThrow();
  });
});
