/**
 * Pure helpers for the feature scorecard and signup cohorts (admin dashboard
 * piece 3).
 *
 * The SQL functions return raw counts; everything derived (rates, lift, the
 * keep/grow/cut hint) is computed here once so web and mobile agree. The
 * thresholds come from the spec and are pinned by analytics-scorecard.test.ts.
 */

import type {
  AnalyticsCohortRow,
  AnalyticsScorecardFeature,
  AnalyticsScorecardRow,
} from "../schemas/admin-analytics.schema";
import { FESTIVAL_RANGE_PREFIX } from "./analytics-metrics";

/** A comparison with fewer than this many users or non-users is not shown. */
export const SCORECARD_MIN_GROUP = 10;
/** Cut needs at least this many attendees... */
export const SCORECARD_CUT_MIN_ATTENDEES = 20;
/** ...and adoption below this share. */
export const SCORECARD_CUT_MAX_ADOPTION = 0.05;
/** Grow needs adoption below this share... */
export const SCORECARD_GROW_MAX_ADOPTION = 0.3;
/** ...and at least this much "came back during the festival" lift, in points. */
export const SCORECARD_GROW_MIN_LIFT_POINTS = 15;

/** Viewed after the festival, so "came back during it" means nothing. */
const NO_WITHIN_FESTIVAL: readonly AnalyticsScorecardFeature[] = ["wrapped"];

export const SCORECARD_HINTS = ["cut", "grow", "keep", "unknown"] as const;
export type ScorecardHint = (typeof SCORECARD_HINTS)[number];

interface ComparisonCounts {
  users: number;
  usersBase: number;
  nonUsers: number;
  nonUsersBase: number;
}

export type ScorecardComparison =
  | { status: "notApplicable" }
  | ({ status: "tooFew" } & ComparisonCounts)
  | ({
      status: "compared";
      usersRate: number;
      nonUsersRate: number;
      /** Users minus non-users, in percentage points, one decimal. */
      liftPoints: number;
    } & ComparisonCounts);

export interface ScoredFeature {
  feature: AnalyticsScorecardFeature;
  attendees: number;
  adopters: number;
  /** Adopters / attendees; null without attendees. */
  adoption: number | null;
  cameBack: ScorecardComparison;
  returned: ScorecardComparison;
  hint: ScorecardHint;
}

function compare(counts: ComparisonCounts): ScorecardComparison {
  if (counts.usersBase < SCORECARD_MIN_GROUP || counts.nonUsersBase < SCORECARD_MIN_GROUP) {
    return { status: "tooFew", ...counts };
  }
  const usersRate = counts.users / counts.usersBase;
  const nonUsersRate = counts.nonUsers / counts.nonUsersBase;
  // Rounded to one decimal so float error (0.35 - 0.2 = 0.1499...) cannot
  // push an exact +15 below the Grow threshold.
  const liftPoints = Math.round((usersRate - nonUsersRate) * 1000) / 10;
  return { status: "compared", usersRate, nonUsersRate, liftPoints, ...counts };
}

function hintFor(
  attendees: number,
  adoption: number | null,
  cameBack: ScorecardComparison,
  returned: ScorecardComparison,
): ScorecardHint {
  if (
    attendees >= SCORECARD_CUT_MIN_ATTENDEES &&
    adoption !== null &&
    adoption < SCORECARD_CUT_MAX_ADOPTION
  ) {
    return "cut";
  }
  if (cameBack.status === "compared") {
    if (
      adoption !== null &&
      adoption < SCORECARD_GROW_MAX_ADOPTION &&
      cameBack.liftPoints >= SCORECARD_GROW_MIN_LIFT_POINTS
    ) {
      return "grow";
    }
    return "keep";
  }
  if (cameBack.status === "notApplicable" && returned.status === "compared") {
    return "keep";
  }
  return "unknown";
}

export function scoreFeature(row: AnalyticsScorecardRow): ScoredFeature {
  const adoption = row.attendees > 0 ? row.adopters / row.attendees : null;
  const cameBack: ScorecardComparison = NO_WITHIN_FESTIVAL.includes(row.feature)
    ? { status: "notApplicable" }
    : compare({
        users: row.cameBackUsers,
        usersBase: row.cameBackUsersBase,
        nonUsers: row.cameBackNonUsers,
        nonUsersBase: row.cameBackNonUsersBase,
      });
  const returned = compare({
    users: row.returnedUsers,
    usersBase: row.returnedUsersBase,
    nonUsers: row.returnedNonUsers,
    nonUsersBase: row.returnedNonUsersBase,
  });
  return {
    feature: row.feature,
    attendees: row.attendees,
    adopters: row.adopters,
    adoption,
    cameBack,
    returned,
    hint: hintFor(row.attendees, adoption, cameBack, returned),
  };
}

export function countHints(scored: readonly ScoredFeature[]): Record<ScorecardHint, number> {
  const counts: Record<ScorecardHint, number> = { cut: 0, grow: 0, keep: 0, unknown: 0 };
  for (const feature of scored) {
    counts[feature.hint] += 1;
  }
  return counts;
}

export interface CohortRates {
  activated: number | null;
  activated7d: number | null;
  engaged: number | null;
  returned: number | null;
}

export function cohortRates(row: AnalyticsCohortRow): CohortRates {
  if (row.signups === 0) {
    return { activated: null, activated7d: null, engaged: null, returned: null };
  }
  return {
    activated: row.activated / row.signups,
    activated7d: row.activated7d / row.signups,
    engaged: row.engaged / row.signups,
    returned: row.returned / row.signups,
  };
}

/**
 * The scorecard follows the dashboard's range selector: a festival key filters
 * it to that festival, a preset shows every festival pooled.
 */
export function scorecardFestivalId(rangeKey: string): string | undefined {
  if (rangeKey.startsWith(FESTIVAL_RANGE_PREFIX)) {
    return rangeKey.slice(FESTIVAL_RANGE_PREFIX.length);
  }
  return undefined;
}

/** "+15", "-3.5", "0". */
export function formatLift(points: number): string {
  if (points > 0) {
    return `+${points}`;
  }
  return `${points}`;
}
