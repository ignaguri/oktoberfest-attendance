/**
 * Pure metric helpers for the admin analytics dashboard.
 *
 * Web and mobile render the same numbers, so every derived value (ranges,
 * summaries, rates) is computed here once instead of in each UI.
 */

import type {
  AnalyticsFeatureUsageRow,
  AnalyticsFestivalRetentionRow,
  AnalyticsFunnelStep,
  AnalyticsOverviewPoint,
} from "../schemas/admin-analytics.schema";

export type AnalyticsRangePreset = "7d" | "30d" | "90d" | "365d";

export const ANALYTICS_RANGE_PRESETS: readonly AnalyticsRangePreset[] = ["7d", "30d", "90d", "365d"];

export const DEFAULT_ANALYTICS_RANGE_PRESET: AnalyticsRangePreset = "30d";

/** Range keys for festivals are `festival:<id>`; presets are their own name. */
export const FESTIVAL_RANGE_PREFIX = "festival:";

/** A feature reaching fewer than this share of active users counts as dead. */
export const DEAD_FEATURE_REACH = 0.05;

const PRESET_DAYS: Record<AnalyticsRangePreset, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

export function festivalRangeKey(festivalId: string): string {
  return `${FESTIVAL_RANGE_PREFIX}${festivalId}`;
}

/** The last `n` UTC days ending today, both bounds inclusive. */
export function rangeForPreset(
  preset: AnalyticsRangePreset,
  today: Date = new Date(),
): { from: string; to: string } {
  const fromDate = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() - (PRESET_DAYS[preset] - 1),
    ),
  );
  return { from: fromDate.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

/**
 * Turns a range key (a preset or `festival:<id>`) into dates. An unknown key,
 * or a festival that is not loaded yet, falls back to the default preset.
 */
export function resolveAnalyticsRange(
  rangeKey: string,
  festivals: readonly { id: string; startDate: string; endDate: string }[] | null | undefined,
  today: Date = new Date(),
): { from: string; to: string } {
  if (rangeKey.startsWith(FESTIVAL_RANGE_PREFIX)) {
    const festivalId = rangeKey.slice(FESTIVAL_RANGE_PREFIX.length);
    const festival = festivals?.find((candidate) => candidate.id === festivalId);
    if (festival) {
      const todayIso = today.toISOString().slice(0, 10);
      const isOngoing = festival.startDate <= todayIso && festival.endDate > todayIso;
      return { from: festival.startDate, to: isOngoing ? todayIso : festival.endDate };
    }
  }
  const preset =
    ANALYTICS_RANGE_PRESETS.find((candidate) => candidate === rangeKey) ??
    DEFAULT_ANALYTICS_RANGE_PRESET;
  return rangeForPreset(preset, today);
}

export interface OverviewSummary {
  dau: number;
  wau: number;
  mau: number;
  /** Mean of daily DAU/MAU over days with any monthly user; null if none. */
  stickiness: number | null;
}

export function summarizeOverview(series: readonly AnalyticsOverviewPoint[]): OverviewSummary {
  const last = series[series.length - 1];
  const ratios = series.filter((point) => point.mau > 0).map((point) => point.dau / point.mau);
  const stickiness =
    ratios.length > 0 ? ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length : null;
  return {
    dau: last?.dau ?? 0,
    wau: last?.wau ?? 0,
    mau: last?.mau ?? 0,
    stickiness,
  };
}

export interface FeatureReachRow extends AnalyticsFeatureUsageRow {
  /** Share of active users who used the feature; null without active users. */
  reach: number | null;
  isDead: boolean;
}

export function withFeatureReach(
  rows: readonly AnalyticsFeatureUsageRow[],
  activeUsers: number,
): FeatureReachRow[] {
  return rows.map((row) => {
    const reach = activeUsers > 0 ? row.users / activeUsers : null;
    return { ...row, reach, isDead: reach !== null && reach < DEAD_FEATURE_REACH };
  });
}

export interface FunnelStepConversion extends AnalyticsFunnelStep {
  fromStart: number | null;
  fromPrevious: number | null;
}

export function funnelConversion(steps: readonly AnalyticsFunnelStep[]): FunnelStepConversion[] {
  const firstUsers = steps[0]?.users ?? 0;
  return steps.map((step, index) => {
    const previousUsers = index > 0 ? steps[index - 1].users : 0;
    return {
      ...step,
      fromStart: firstUsers > 0 ? step.users / firstUsers : null,
      fromPrevious: index > 0 && previousUsers > 0 ? step.users / previousUsers : null,
    };
  });
}

/**
 * Drops festivals nobody has attended yet (e.g. an upcoming festival) so
 * retention tables never render a row of zeros; callers keep their own empty
 * state for when nothing remains.
 */
export function visibleFestivalRetentionRows(
  rows: readonly AnalyticsFestivalRetentionRow[],
): AnalyticsFestivalRetentionRow[] {
  return rows.filter((row) => row.attendees > 0);
}

export function retentionRates(row: AnalyticsFestivalRetentionRow): {
  next: number | null;
  any: number | null;
} {
  if (row.attendees === 0) {
    return { next: null, any: null };
  }
  return {
    next: row.returnedNext === null ? null : row.returnedNext / row.attendees,
    any: row.returnedAny / row.attendees,
  };
}

/** Whole-percent label; a dash when there is no rate to show. */
export function formatPercent(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}
