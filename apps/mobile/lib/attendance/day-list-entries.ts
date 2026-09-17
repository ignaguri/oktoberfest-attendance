/**
 * Row model for the attendance day list, and the money formatting it renders.
 *
 * Lives in `lib` rather than beside the component because the mobile vitest
 * config only collects `lib/**​/__tests__`, so anything left in a .tsx file is
 * untestable by construction. The merge rules here are the kind that break
 * quietly - a day with both an attendance and a reservation appearing twice, or
 * the ordering slipping when two kinds of row interleave - so they are worth
 * pinning. Same reasoning as ./tent-visit-rows.
 */

import type { AttendanceWithTotals, DayPlan } from "@prostcounter/shared/schemas";

/** One row in the merged, date-descending list. */
export type DayListEntry =
  | { kind: "attendance"; date: string; attendance: AttendanceWithTotals }
  | { kind: "reservationOnly"; date: string; reservation: DayPlan }
  | { kind: "planOnly"; date: string; plan: DayPlan };

/**
 * Merge logged days with days that only carry a plan or a reservation into one
 * date-descending list.
 *
 * A day with an attendance never also produces a plan or reservation row: the
 * attendance row already carries the day, and two rows for one date would read
 * as two separate outings. A plan on a day that has passed is dropped, since a
 * plan only says something about the future; a past reservation stays, as it
 * did before plans existed.
 *
 * @param plansByDate active marks keyed by YYYY-MM-DD (see buildDayPlansByDate)
 * @param today the device's current day, YYYY-MM-DD
 */
export function buildDayListEntries(
  attendances: AttendanceWithTotals[],
  plansByDate: Map<string, DayPlan>,
  today: string,
): DayListEntry[] {
  const attendanceDates = new Set(attendances.map((attendance) => attendance.date));

  const entries: DayListEntry[] = attendances.map((attendance) => ({
    kind: "attendance",
    date: attendance.date,
    attendance,
  }));

  for (const [date, plan] of plansByDate) {
    if (attendanceDates.has(date)) {
      continue;
    }
    if (plan.kind === "reservation") {
      entries.push({ kind: "reservationOnly", date, reservation: plan });
      continue;
    }
    if (date >= today) {
      entries.push({ kind: "planOnly", date, plan });
    }
  }

  // Plain string compare: the keys are YYYY-MM-DD, which sorts chronologically.
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Whole euros when the amount has none, two decimals when it does.
 *
 * The festival summary card above the list renders whole euros, and under the
 * default tip mode every price paid lands on one, so most rows read the same
 * either way. Sub-euro amounts are the exception that matters: rounding a €1.80
 * tip to €2, or a €0.20 one to €0 on a row that only renders because the tip is
 * non-zero, states an amount the user never paid.
 */
export function formatEuros(cents: number): string {
  const euros = cents / 100;
  return `€${cents % 100 === 0 ? euros : euros.toFixed(2)}`;
}
