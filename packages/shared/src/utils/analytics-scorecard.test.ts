import { describe, expect, it } from "vitest";

import type { AnalyticsCohortRow, AnalyticsScorecardRow } from "../schemas/admin-analytics.schema";
import {
  cohortRates,
  countHints,
  formatLift,
  scoreFeature,
  scorecardFestivalId,
} from "./analytics-scorecard";

/** A row with enough data everywhere; tests override what they probe. */
function row(overrides: Partial<AnalyticsScorecardRow> = {}): AnalyticsScorecardRow {
  return {
    feature: "day_plans",
    attendees: 100,
    adopters: 50,
    cameBackUsers: 25,
    cameBackUsersBase: 50,
    cameBackNonUsers: 25,
    cameBackNonUsersBase: 50,
    returnedUsers: 10,
    returnedUsersBase: 50,
    returnedNonUsers: 10,
    returnedNonUsersBase: 50,
    ...overrides,
  };
}

describe("scoreFeature", () => {
  it("computes adoption, rates and lift", () => {
    const scored = scoreFeature(
      row({ cameBackUsers: 40, cameBackNonUsers: 20, returnedUsers: 5, returnedNonUsers: 10 }),
    );
    expect(scored.adoption).toBe(0.5);
    expect(scored.cameBack).toMatchObject({
      status: "compared",
      usersRate: 0.8,
      nonUsersRate: 0.4,
      liftPoints: 40,
    });
    expect(scored.returned).toMatchObject({ status: "compared", liftPoints: -10 });
  });

  it("has no adoption without attendees", () => {
    const scored = scoreFeature(
      row({
        attendees: 0,
        adopters: 0,
        cameBackUsersBase: 0,
        cameBackNonUsersBase: 0,
        returnedUsersBase: 0,
        returnedNonUsersBase: 0,
        cameBackUsers: 0,
        cameBackNonUsers: 0,
        returnedUsers: 0,
        returnedNonUsers: 0,
      }),
    );
    expect(scored.adoption).toBeNull();
    expect(scored.hint).toBe("unknown");
  });

  it("marks a comparison with 9 users as too few", () => {
    const scored = scoreFeature(row({ cameBackUsersBase: 9, cameBackUsers: 5 }));
    expect(scored.cameBack).toEqual({
      status: "tooFew",
      users: 5,
      usersBase: 9,
      nonUsers: 25,
      nonUsersBase: 50,
    });
  });

  it("marks a comparison with 9 non-users as too few", () => {
    const scored = scoreFeature(row({ cameBackNonUsersBase: 9, cameBackNonUsers: 1 }));
    expect(scored.cameBack.status).toBe("tooFew");
  });

  it("compares with exactly 10 on each side", () => {
    const scored = scoreFeature(
      row({
        cameBackUsersBase: 10,
        cameBackUsers: 5,
        cameBackNonUsersBase: 10,
        cameBackNonUsers: 5,
      }),
    );
    expect(scored.cameBack.status).toBe("compared");
  });

  it("has no within-festival comparison for wrapped", () => {
    expect(scoreFeature(row({ feature: "wrapped" })).cameBack).toEqual({
      status: "notApplicable",
    });
  });

  it("rounds lift so exactly +15 points is not 14.99", () => {
    // 0.35 - 0.2 is 0.1499999... in floating point
    const scored = scoreFeature(
      row({
        cameBackUsers: 35,
        cameBackUsersBase: 100,
        cameBackNonUsers: 20,
        cameBackNonUsersBase: 100,
      }),
    );
    expect(scored.cameBack).toMatchObject({ liftPoints: 15 });
  });
});

describe("scoreFeature hint", () => {
  it("cuts under 5% adoption with 20+ attendees", () => {
    expect(scoreFeature(row({ attendees: 1000, adopters: 49 })).hint).toBe("cut");
  });

  it("does not cut at exactly 5% adoption", () => {
    expect(scoreFeature(row({ attendees: 1000, adopters: 50 })).hint).not.toBe("cut");
  });

  it("does not cut with 19 attendees", () => {
    expect(scoreFeature(row({ attendees: 19, adopters: 0 })).hint).not.toBe("cut");
  });

  it("cuts with exactly 20 attendees and no adopters", () => {
    expect(scoreFeature(row({ attendees: 20, adopters: 0 })).hint).toBe("cut");
  });

  it("grows under 30% adoption with +15 points lift", () => {
    const scored = scoreFeature(
      row({
        attendees: 1000,
        adopters: 299,
        cameBackUsers: 35,
        cameBackUsersBase: 100,
        cameBackNonUsers: 20,
        cameBackNonUsersBase: 100,
      }),
    );
    expect(scored.hint).toBe("grow");
  });

  it("keeps at exactly 30% adoption even with a big lift", () => {
    const scored = scoreFeature(
      row({
        attendees: 1000,
        adopters: 300,
        cameBackUsers: 90,
        cameBackUsersBase: 100,
        cameBackNonUsers: 10,
        cameBackNonUsersBase: 100,
      }),
    );
    expect(scored.hint).toBe("keep");
  });

  it("keeps with +14.9 points lift", () => {
    const scored = scoreFeature(
      row({
        attendees: 5000,
        adopters: 1000,
        cameBackUsers: 149,
        cameBackUsersBase: 1000,
        cameBackNonUsers: 0,
        cameBackNonUsersBase: 10,
      }),
    );
    expect(scored.cameBack).toMatchObject({ liftPoints: 14.9 });
    expect(scored.hint).toBe("keep");
  });

  it("says not enough data when the within-festival comparison has too few", () => {
    expect(scoreFeature(row({ cameBackNonUsersBase: 9 })).hint).toBe("unknown");
  });

  it("keeps wrapped on the later-festival comparison and never grows it", () => {
    const scored = scoreFeature(
      row({
        feature: "wrapped",
        attendees: 1000,
        adopters: 100,
        returnedUsers: 90,
        returnedUsersBase: 100,
        returnedNonUsers: 10,
        returnedNonUsersBase: 100,
      }),
    );
    expect(scored.hint).toBe("keep");
  });

  it("says not enough data for wrapped when the later-festival comparison has too few", () => {
    expect(scoreFeature(row({ feature: "wrapped", returnedUsersBase: 9 })).hint).toBe("unknown");
  });

  it("still cuts wrapped on adoption", () => {
    expect(scoreFeature(row({ feature: "wrapped", attendees: 1000, adopters: 10 })).hint).toBe(
      "cut",
    );
  });
});

describe("countHints", () => {
  it("counts every hint, zeros included", () => {
    const scored = [
      scoreFeature(row({ attendees: 1000, adopters: 1 })),
      scoreFeature(row({ attendees: 1000, adopters: 2 })),
      scoreFeature(row()),
    ];
    expect(countHints(scored)).toEqual({ cut: 2, grow: 0, keep: 1, unknown: 0 });
  });
});

describe("cohortRates", () => {
  const cohort: AnalyticsCohortRow = {
    month: "2026-09-01",
    signups: 20,
    activated: 10,
    activated7d: 5,
    engaged: 4,
    returned: 2,
  };

  it("divides every step by signups", () => {
    expect(cohortRates(cohort)).toEqual({
      activated: 0.5,
      activated7d: 0.25,
      engaged: 0.2,
      returned: 0.1,
    });
  });

  it("has no rates without signups", () => {
    expect(
      cohortRates({ ...cohort, signups: 0, activated: 0, activated7d: 0, engaged: 0, returned: 0 }),
    ).toEqual({ activated: null, activated7d: null, engaged: null, returned: null });
  });
});

describe("scorecardFestivalId", () => {
  it("reads the festival out of a festival range key", () => {
    expect(scorecardFestivalId("festival:abc")).toBe("abc");
  });

  it("is undefined for a preset", () => {
    expect(scorecardFestivalId("30d")).toBeUndefined();
  });
});

describe("formatLift", () => {
  it("signs positive lift", () => {
    expect(formatLift(15)).toBe("+15");
  });

  it("keeps the minus of negative lift", () => {
    expect(formatLift(-3.5)).toBe("-3.5");
  });

  it("shows zero without a sign", () => {
    expect(formatLift(0)).toBe("0");
  });
});
