import { describe, expect, it } from "vitest";

import { enumerateBackfillPairs, summariseDelta } from "./backfill-achievements";

describe("enumerateBackfillPairs", () => {
  it("emits one pair per attended festival plus one lifetime pass per user", () => {
    const attendanceRows = [
      { user_id: "u1", festival_id: "f1" },
      { user_id: "u1", festival_id: "f2" },
      { user_id: "u2", festival_id: "f1" },
    ];

    const pairs = enumerateBackfillPairs(attendanceRows, ["u1", "u2"]);

    expect(pairs).toEqual([
      { userId: "u1", festivalId: "f1" },
      { userId: "u1", festivalId: "f2" },
      { userId: "u2", festivalId: "f1" },
      { userId: "u1", festivalId: null },
      { userId: "u2", festivalId: null },
    ]);
  });

  it("emits a lifetime pass for users who have never attended anything", () => {
    const pairs = enumerateBackfillPairs([], ["u3"]);

    expect(pairs).toEqual([{ userId: "u3", festivalId: null }]);
  });

  it("deduplicates repeated user/festival rows", () => {
    const attendanceRows = [
      { user_id: "u1", festival_id: "f1" },
      { user_id: "u1", festival_id: "f1" },
    ];

    expect(enumerateBackfillPairs(attendanceRows, ["u1"])).toEqual([
      { userId: "u1", festivalId: "f1" },
      { userId: "u1", festivalId: null },
    ]);
  });
});

describe("summariseDelta", () => {
  it("counts new unlocks per user and totals them", () => {
    const summary = summariseDelta([
      { userId: "u1", festivalId: "f1", slugs: ["drinks_total.t1", "days_attended.t1"] },
      { userId: "u1", festivalId: "f2", slugs: ["drinks_total.t1"] },
      { userId: "u2", festivalId: "f1", slugs: [] },
    ]);

    expect(summary.totalUnlocks).toBe(3);
    expect(summary.perUser.get("u1")).toBe(3);
    expect(summary.perUser.has("u2")).toBe(false);
  });
});
