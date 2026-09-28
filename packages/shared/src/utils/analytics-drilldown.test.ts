import { describe, expect, it } from "vitest";

import type {
  AnalyticsCohortRow,
  AnalyticsMember,
  AnalyticsScorecardRow,
  AnalyticsTimelineRow,
} from "../schemas/admin-analytics.schema";
import {
  COHORT_STEP_FILTERS,
  cohortStepCount,
  FUNNEL_STEP_MIN_DAYS,
  groupTimelineByDay,
  SCORECARD_SEGMENT_FILTERS,
  scorecardSegmentCount,
  sortMembers,
  timelineLabelKey,
  timelinePropsText,
} from "./analytics-drilldown";

const SCORECARD_ROW: AnalyticsScorecardRow = {
  feature: "photos",
  attendees: 40,
  adopters: 12,
  cameBackUsers: 9,
  cameBackUsersBase: 12,
  cameBackNonUsers: 11,
  cameBackNonUsersBase: 28,
  returnedUsers: 4,
  returnedUsersBase: 10,
  returnedNonUsers: 3,
  returnedNonUsersBase: 20,
};

const COHORT_ROW: AnalyticsCohortRow = {
  month: "2026-09-01",
  signups: 30,
  activated: 20,
  activated7d: 15,
  engaged: 8,
  returned: 2,
};

function member(overrides: Partial<AnalyticsMember>): AnalyticsMember {
  return {
    userId: "u",
    username: null,
    fullName: null,
    signedUpAt: null,
    lastActiveDay: null,
    ...overrides,
  };
}

function timelineRow(occurredAt: string, cursorKey: string): AnalyticsTimelineRow {
  return {
    occurredAt,
    kind: "event",
    name: "app_opened",
    props: {},
    festivalId: null,
    festivalName: null,
    platform: "ios",
    appVersion: "3.1.0",
    sessionId: null,
    cursorKey,
  };
}

describe("drill-target filters", () => {
  it("maps funnel steps to minimum attendance days", () => {
    expect(FUNNEL_STEP_MIN_DAYS).toEqual({ signed_up: 0, logged_attendance: 1, five_days: 5 });
  });

  it("maps each scorecard segment to its flags", () => {
    expect(SCORECARD_SEGMENT_FILTERS.attendees).toEqual({});
    expect(SCORECARD_SEGMENT_FILTERS.non_adopters).toEqual({ is_user: false });
    expect(SCORECARD_SEGMENT_FILTERS.returned_adopters).toEqual({
      is_user: true,
      successor_started: true,
      returned: true,
    });
  });

  it("maps each cohort step to its flag", () => {
    expect(COHORT_STEP_FILTERS.signups).toEqual({});
    expect(COHORT_STEP_FILTERS.activated_7d).toEqual({ activated_7d: true });
  });
});

describe("scorecardSegmentCount", () => {
  it("returns the scorecard number each segment's list must add up to", () => {
    expect(scorecardSegmentCount(SCORECARD_ROW, "attendees")).toBe(40);
    expect(scorecardSegmentCount(SCORECARD_ROW, "adopters")).toBe(12);
    expect(scorecardSegmentCount(SCORECARD_ROW, "non_adopters")).toBe(28);
    expect(scorecardSegmentCount(SCORECARD_ROW, "came_back_adopters")).toBe(9);
    expect(scorecardSegmentCount(SCORECARD_ROW, "came_back_non_adopters")).toBe(11);
    expect(scorecardSegmentCount(SCORECARD_ROW, "returned_adopters")).toBe(4);
    expect(scorecardSegmentCount(SCORECARD_ROW, "returned_non_adopters")).toBe(3);
  });
});

describe("cohortStepCount", () => {
  it("returns the cohort number for each step", () => {
    expect(cohortStepCount(COHORT_ROW, "signups")).toBe(30);
    expect(cohortStepCount(COHORT_ROW, "activated")).toBe(20);
    expect(cohortStepCount(COHORT_ROW, "activated_7d")).toBe(15);
    expect(cohortStepCount(COHORT_ROW, "engaged")).toBe(8);
    expect(cohortStepCount(COHORT_ROW, "returned")).toBe(2);
  });
});

describe("sortMembers", () => {
  it("puts the most recently active first and people never active last", () => {
    const sorted = sortMembers([
      member({ userId: "a", lastActiveDay: null, fullName: "Ana" }),
      member({ userId: "b", lastActiveDay: "2026-09-01", fullName: "Bea" }),
      member({ userId: "c", lastActiveDay: "2026-09-20", fullName: "Cai" }),
    ]);
    expect(sorted.map((row) => row.userId)).toEqual(["c", "b", "a"]);
  });

  it("breaks ties by name, then user id, then festival", () => {
    const sorted = sortMembers([
      member({ userId: "z", lastActiveDay: "2026-09-01", username: "bruno" }),
      member({ userId: "y", lastActiveDay: "2026-09-01", fullName: "Alma" }),
      member({ userId: "x", lastActiveDay: "2026-09-01", fullName: "Alma", festivalName: "B" }),
      member({ userId: "x", lastActiveDay: "2026-09-01", fullName: "Alma", festivalName: "A" }),
    ]);
    expect(sorted.map((row) => `${row.userId}${row.festivalName ?? ""}`)).toEqual([
      "xA",
      "xB",
      "y",
      "z",
    ]);
  });

  it("does not mutate its input", () => {
    const input = [member({ userId: "b" }), member({ userId: "a" })];
    sortMembers(input);
    expect(input.map((row) => row.userId)).toEqual(["b", "a"]);
  });
});

describe("timelineLabelKey", () => {
  it("has a key for every known action and event", () => {
    expect(timelineLabelKey("drink")).toBe("admin.analytics.timeline.names.drink");
    expect(timelineLabelKey("app_opened")).toBe("admin.analytics.timeline.names.app_opened");
  });

  it("falls back to the generic key for a name it does not know", () => {
    expect(timelineLabelKey("brand_new_event")).toBe("admin.analytics.timeline.names.unknown");
  });
});

describe("timelinePropsText", () => {
  it("joins props as key: value pairs and skips empty values", () => {
    expect(timelinePropsText({ screen: "/home", step: 2, missing: null })).toBe(
      "screen: /home · step: 2",
    );
  });

  it("is empty when there are no props", () => {
    expect(timelinePropsText({})).toBe("");
  });
});

describe("groupTimelineByDay", () => {
  it("groups consecutive rows by local day, keeping their order", () => {
    const rows = [
      timelineRow("2026-09-28T22:30:00+00:00", "event:3"),
      timelineRow("2026-09-28T09:00:00+00:00", "event:2"),
      timelineRow("2026-09-27T21:00:00+00:00", "event:1"),
    ];
    // 22:30 UTC is already the 29th in Berlin; 21:00 UTC on the 27th is still the 27th
    expect(
      groupTimelineByDay(rows, "Europe/Berlin").map((day) => [
        day.day,
        day.rows.map((row) => row.cursorKey),
      ]),
    ).toEqual([
      ["2026-09-29", ["event:3"]],
      ["2026-09-28", ["event:2"]],
      ["2026-09-27", ["event:1"]],
    ]);
  });

  it("returns no days for no rows", () => {
    expect(groupTimelineByDay([], "UTC")).toEqual([]);
  });
});
