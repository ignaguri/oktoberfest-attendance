/**
 * Admin analytics drill-down (piece 2): which rows of the *_members SQL
 * functions are behind each dashboard number, and helpers for the timeline.
 *
 * The filter tables are the single TS definition of every drill target. The
 * API applies them as PostgREST filters, and analytics-drilldown.integration.test.ts
 * checks that each filtered list has exactly as many rows as the aggregate says.
 */
import { EVENT_NAMES } from "../analytics/events";
import {
  ANALYTICS_TIMELINE_ACTIONS,
  type AnalyticsCohortRow,
  type AnalyticsCohortStep,
  type AnalyticsFunnelStepName,
  type AnalyticsMember,
  type AnalyticsScorecardRow,
  type AnalyticsScorecardSegment,
  type AnalyticsTimelineRow,
} from "../schemas/admin-analytics.schema";

/** Funnel members are listed by attendance_days >= this. Mirrors analytics_activation_funnel. */
export const FUNNEL_STEP_MIN_DAYS: Record<AnalyticsFunnelStepName, number> = {
  signed_up: 0,
  logged_attendance: 1,
  five_days: 5,
};

/** Boolean columns of analytics_scorecard_members. */
export type ScorecardMemberFlag = "is_user" | "came_back" | "successor_started" | "returned";

export const SCORECARD_SEGMENT_FILTERS: Record<
  AnalyticsScorecardSegment,
  Partial<Record<ScorecardMemberFlag, boolean>>
> = {
  attendees: {},
  adopters: { is_user: true },
  non_adopters: { is_user: false },
  came_back_adopters: { is_user: true, came_back: true },
  came_back_non_adopters: { is_user: false, came_back: true },
  returned_adopters: { is_user: true, successor_started: true, returned: true },
  returned_non_adopters: { is_user: false, successor_started: true, returned: true },
};

/** Boolean columns of analytics_cohort_members. */
export type CohortMemberFlag = "activated" | "activated_7d" | "engaged" | "returned";

export const COHORT_STEP_FILTERS: Record<
  AnalyticsCohortStep,
  Partial<Record<CohortMemberFlag, boolean>>
> = {
  signups: {},
  activated: { activated: true },
  activated_7d: { activated_7d: true },
  engaged: { engaged: true },
  returned: { returned: true },
};

/** The scorecard number a segment's list adds up to. */
export function scorecardSegmentCount(
  row: AnalyticsScorecardRow,
  segment: AnalyticsScorecardSegment,
): number {
  switch (segment) {
    case "attendees":
      return row.attendees;
    case "adopters":
      return row.adopters;
    case "non_adopters":
      return row.attendees - row.adopters;
    case "came_back_adopters":
      return row.cameBackUsers;
    case "came_back_non_adopters":
      return row.cameBackNonUsers;
    case "returned_adopters":
      return row.returnedUsers;
    case "returned_non_adopters":
      return row.returnedNonUsers;
  }
}

/** The cohort number a step's list adds up to. */
export function cohortStepCount(row: AnalyticsCohortRow, step: AnalyticsCohortStep): number {
  switch (step) {
    case "signups":
      return row.signups;
    case "activated":
      return row.activated;
    case "activated_7d":
      return row.activated7d;
    case "engaged":
      return row.engaged;
    case "returned":
      return row.returned;
  }
}

function memberName(member: AnalyticsMember): string {
  return member.fullName ?? member.username ?? "";
}

/**
 * Most recently active first, never-active last; then name, user id and
 * festival so the order is stable. Returns a new array.
 */
export function sortMembers(members: readonly AnalyticsMember[]): AnalyticsMember[] {
  return [...members].sort((left, right) => {
    if (left.lastActiveDay !== right.lastActiveDay) {
      if (left.lastActiveDay === null) {
        return 1;
      }
      if (right.lastActiveDay === null) {
        return -1;
      }
      return right.lastActiveDay.localeCompare(left.lastActiveDay);
    }
    const byName = memberName(left).localeCompare(memberName(right));
    if (byName !== 0) {
      return byName;
    }
    const byUser = left.userId.localeCompare(right.userId);
    if (byUser !== 0) {
      return byUser;
    }
    return (left.festivalName ?? "").localeCompare(right.festivalName ?? "");
  });
}

const KNOWN_TIMELINE_NAMES = new Set<string>([...ANALYTICS_TIMELINE_ACTIONS, ...EVENT_NAMES]);

/**
 * i18n key for a timeline row's label. analytics.events has no CHECK on name,
 * so an unknown name gets the generic key (which interpolates {{name}}).
 */
export function timelineLabelKey(name: string): string {
  return KNOWN_TIMELINE_NAMES.has(name)
    ? `admin.analytics.timeline.names.${name}`
    : "admin.analytics.timeline.names.unknown";
}

/** A row's props as "key: value" pairs for its detail line; empty when none. */
export function timelinePropsText(props: Record<string, unknown>): string {
  return Object.entries(props)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(
      ([key, value]) =>
        `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`,
    )
    .join(" · ");
}

export interface TimelineDay {
  /** YYYY-MM-DD in the given timezone. */
  day: string;
  rows: AnalyticsTimelineRow[];
}

/** Consecutive rows grouped by their local day in `timeZone`, order kept. */
export function groupTimelineByDay(
  rows: readonly AnalyticsTimelineRow[],
  timeZone: string,
): TimelineDay[] {
  const dayFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const days: TimelineDay[] = [];
  for (const row of rows) {
    const day = dayFormat.format(new Date(row.occurredAt));
    const current = days[days.length - 1];
    if (current && current.day === day) {
      current.rows.push(row);
    } else {
      days.push({ day, rows: [row] });
    }
  }
  return days;
}
