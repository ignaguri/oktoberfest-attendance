/**
 * Chart data for the admin analytics dashboard (piece 4), shared by the
 * mobile Victory charts and the web recharts overview.
 *
 * Everything here is pure: row builders shape API responses into chart rows,
 * the series lists fix each line's name and colour so both apps agree, and
 * the formatters produce axis and readout text.
 */

import type {
  AnalyticsCohortRow,
  AnalyticsFestivalRetentionRow,
  AnalyticsOverviewPoint,
} from "../schemas/admin-analytics.schema";
import { formatPercent, retentionRates } from "./analytics-metrics";
import { cohortRates } from "./analytics-scorecard";
import { formatLocalized } from "./date-utils";

export type ChartYFormat = "count" | "percent";

export interface ChartSeries<K extends string> {
  key: K;
  /** i18n key for the line's name. */
  labelKey: string;
  color: string;
  format: ChartYFormat;
}

/** Brand palette the web overview already used. */
export const CHART_COLORS = {
  primary: "#F59E0B",
  secondary: "#D97706",
  neutral: "#78716C",
} as const;

export type OverviewSeriesKey = "dau" | "wau" | "mau";
export type RetentionSeriesKey = "returnedNext" | "returnedAny";
export type CohortSeriesKey = "activated" | "engaged" | "returned";

export const OVERVIEW_SERIES: readonly ChartSeries<OverviewSeriesKey>[] = [
  {
    key: "dau",
    labelKey: "admin.analytics.overview.dau",
    color: CHART_COLORS.primary,
    format: "count",
  },
  {
    key: "wau",
    labelKey: "admin.analytics.overview.wau",
    color: CHART_COLORS.secondary,
    format: "count",
  },
  {
    key: "mau",
    labelKey: "admin.analytics.overview.mau",
    color: CHART_COLORS.neutral,
    format: "count",
  },
];

export const RETENTION_SERIES: readonly ChartSeries<RetentionSeriesKey>[] = [
  {
    key: "returnedNext",
    labelKey: "admin.analytics.retention.returnedNext",
    color: CHART_COLORS.primary,
    format: "percent",
  },
  {
    key: "returnedAny",
    labelKey: "admin.analytics.retention.returnedAny",
    color: CHART_COLORS.neutral,
    format: "percent",
  },
];

/** activated7d is left out: it tracks activated closely and only adds noise. */
export const COHORT_SERIES: readonly ChartSeries<CohortSeriesKey>[] = [
  {
    key: "activated",
    labelKey: "admin.analytics.cohorts.activated",
    color: CHART_COLORS.primary,
    format: "percent",
  },
  {
    key: "engaged",
    labelKey: "admin.analytics.cohorts.engaged",
    color: CHART_COLORS.secondary,
    format: "percent",
  },
  {
    key: "returned",
    labelKey: "admin.analytics.cohorts.returned",
    color: CHART_COLORS.neutral,
    format: "percent",
  },
];

export interface OverviewChartRow {
  /** YYYY-MM-DD */
  x: string;
  dau: number;
  wau: number;
  mau: number;
}

export interface RetentionChartRow {
  /** Festival name */
  x: string;
  festivalId: string;
  attendees: number;
  /** Null while the next festival has not started, which draws as a gap. */
  returnedNext: number | null;
  returnedAny: number | null;
}

export interface CohortChartRow {
  /** YYYY-MM */
  x: string;
  signups: number;
  activated: number | null;
  engaged: number | null;
  returned: number | null;
  counts: Record<CohortSeriesKey, number>;
}

/** The API already returns days oldest first. */
export function overviewChartRows(series: readonly AnalyticsOverviewPoint[]): OverviewChartRow[] {
  return series.map((point) => ({ x: point.day, dau: point.dau, wau: point.wau, mau: point.mau }));
}

/** Pass visibleFestivalRetentionRows(...) in; rows come back oldest first. */
export function retentionChartRows(
  festivals: readonly AnalyticsFestivalRetentionRow[],
): RetentionChartRow[] {
  return [...festivals]
    .sort((first, second) => first.startDate.localeCompare(second.startDate))
    .map((festival) => {
      const rates = retentionRates(festival);
      return {
        x: festival.festivalName,
        festivalId: festival.festivalId,
        attendees: festival.attendees,
        returnedNext: rates.next,
        returnedAny: rates.any,
      };
    });
}

/** The API returns months newest first; charts read oldest first. */
export function cohortChartRows(cohorts: readonly AnalyticsCohortRow[]): CohortChartRow[] {
  return [...cohorts]
    .sort((first, second) => first.month.localeCompare(second.month))
    .map((cohort) => {
      const rates = cohortRates(cohort);
      return {
        x: cohort.month.slice(0, 7),
        signups: cohort.signups,
        activated: rates.activated,
        engaged: rates.engaged,
        returned: rates.returned,
        counts: { activated: cohort.activated, engaged: cohort.engaged, returned: cohort.returned },
      };
    });
}

/** Row the readout shows: the pressed one, or the latest at rest. */
export function readoutIndex(length: number, pressedIndex: number | null): number | null {
  if (length === 0) {
    return null;
  }
  if (pressedIndex === null) {
    return length - 1;
  }
  return Math.min(Math.max(pressedIndex, 0), length - 1);
}

/** Evenly spaced x labels that always include the first and last row. */
export function xTickIndices(length: number, maxTicks: number): number[] {
  if (length <= 0) {
    return [];
  }
  if (length <= maxTicks) {
    return Array.from({ length }, (_, index) => index);
  }
  if (maxTicks <= 1) {
    return [length - 1];
  }
  const step = (length - 1) / (maxTicks - 1);
  return [...new Set(Array.from({ length: maxTicks }, (_, index) => Math.round(index * step)))];
}

/** Legend toggle; the last visible series stays on so the chart never empties. */
export function toggleSeries<K extends string>(
  visible: readonly K[],
  key: K,
  allKeys: readonly K[],
): K[] {
  if (visible.includes(key)) {
    if (visible.length === 1) {
      return [...visible];
    }
    return visible.filter((candidate) => candidate !== key);
  }
  return allKeys.filter((candidate) => candidate === key || visible.includes(candidate));
}

export function formatChartValue(value: number | null, format: ChartYFormat): string {
  if (value === null) {
    return formatPercent(null);
  }
  if (format === "percent") {
    return formatPercent(value);
  }
  return String(Math.round(value));
}

/** "42% · 5/12": small cohorts make a bare rate jumpy. */
export function formatCohortReadout(rate: number | null, count: number, signups: number): string {
  return `${formatPercent(rate)} · ${count}/${signups}`;
}

/** Local calendar date; new Date("YYYY-MM-DD") would parse as UTC midnight. */
function localDate(isoDay: string): Date {
  const [year = 1970, month = 1, day = 1] = isoDay.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatChartDayTick(day: string): string {
  return formatLocalized(localDate(day), "MMM d");
}

/** Accepts YYYY-MM or YYYY-MM-DD. */
export function formatChartMonthTick(month: string): string {
  return formatLocalized(localDate(`${month.slice(0, 7)}-01`), "MMM yy");
}

/** "Oktoberfest 2024" -> "Okto '24", so festival names fit under the axis. */
export function shortFestivalLabel(name: string): string {
  const match = name.match(/^(.*?)\s*(\d{4})$/);
  if (!match) {
    return name.slice(0, 8);
  }
  const base = (match[1] ?? "").trim();
  const year = match[2] ?? "";
  if (!base) {
    return year;
  }
  return `${base.slice(0, 4)} '${year.slice(2)}`;
}
