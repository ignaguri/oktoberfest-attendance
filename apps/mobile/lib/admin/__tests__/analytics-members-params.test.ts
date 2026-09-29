import { describe, expect, it } from "vitest";

import {
  type MembersTarget,
  membersRouteParams,
  parseMembersParams,
} from "../analytics-members-params";

const FESTIVAL_ID = "33333333-3333-4333-8333-333333333333";

describe("parseMembersParams", () => {
  it("reads a funnel target", () => {
    expect(
      parseMembersParams({
        metric: "funnel",
        from: "2026-09-01",
        to: "2026-09-30",
        platform: "ios",
        step: "five_days",
      }),
    ).toEqual({
      metric: "funnel",
      from: "2026-09-01",
      to: "2026-09-30",
      platform: "ios",
      step: "five_days",
    });
  });

  it("reads a scorecard target with its festival name", () => {
    expect(
      parseMembersParams({
        metric: "scorecard",
        festivalId: FESTIVAL_ID,
        festivalName: "Oktoberfest 2026",
        feature: "photos",
        segment: "adopters",
      }),
    ).toEqual({
      metric: "scorecard",
      festivalId: FESTIVAL_ID,
      festivalName: "Oktoberfest 2026",
      feature: "photos",
      segment: "adopters",
    });
  });

  it("reads a cohort target", () => {
    expect(parseMembersParams({ metric: "cohorts", month: "2026-09-01", step: "engaged" })).toEqual(
      {
        metric: "cohorts",
        month: "2026-09-01",
        step: "engaged",
      },
    );
  });

  it("returns null for missing or malformed params", () => {
    expect(parseMembersParams({})).toBeNull();
    expect(parseMembersParams({ metric: "retention" })).toBeNull();
    expect(
      parseMembersParams({ metric: "funnel", from: "2026-09-01", step: "five_days" }),
    ).toBeNull();
    expect(
      parseMembersParams({ metric: "scorecard", feature: "photos", segment: "fans" }),
    ).toBeNull();
    expect(
      parseMembersParams({ metric: "cohorts", month: "2026-09-15", step: "engaged" }),
    ).toBeNull();
    expect(
      parseMembersParams({ metric: ["funnel", "cohorts"], month: "2026-09-01", step: "engaged" }),
    ).toBeNull();
  });
});

describe("membersRouteParams", () => {
  it("round-trips every target through route params, dropping empty values", () => {
    const targets: MembersTarget[] = [
      { metric: "funnel", from: "2026-09-01", to: "2026-09-30", step: "signed_up" },
      { metric: "scorecard", feature: "drinks", segment: "non_adopters" },
      { metric: "cohorts", month: "2026-08-01", step: "returned" },
    ];
    for (const target of targets) {
      const params = membersRouteParams(target);
      expect(Object.values(params).every((value) => typeof value === "string")).toBe(true);
      expect(parseMembersParams(params)).toEqual(target);
    }
  });
});
