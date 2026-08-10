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

import type { AttendanceWithTotals, Reservation } from "@prostcounter/shared/schemas";
import { format } from "date-fns";

import { isActiveReservation } from "@/lib/utils/reservation";

/** One row in the merged, date-descending list. */
export type DayListEntry =
  | { kind: "attendance"; date: string; attendance: AttendanceWithTotals }
  | { kind: "reservationOnly"; date: string; reservation: Reservation };

/**
 * Active reservations by day key, one per day.
 *
 * Shared by the strip and the list, which each built this independently and
 * would have drifted. A day holding two reservations keeps the last one seen:
 * both views show a single marker per day, so there is nothing to render for a
 * second, and picking one arbitrarily is honest about that.
 */
export function buildActiveReservationsByDate(
  reservations: Reservation[],
): Map<string, Reservation> {
  const map = new Map<string, Reservation>();
  for (const reservation of reservations) {
    if (!isActiveReservation(reservation)) {
      continue;
    }
    map.set(format(new Date(reservation.startAt), "yyyy-MM-dd"), reservation);
  }
  return map;
}

/**
 * Merge logged days and reservation-only days into one date-descending list.
 *
 * A day with an attendance never also produces a reservation row: the
 * attendance row already carries the day, and two rows for one date would read
 * as two separate outings.
 */
export function buildDayListEntries(
  attendances: AttendanceWithTotals[],
  reservationsByDate: Map<string, Reservation>,
): DayListEntry[] {
  const attendanceDates = new Set(attendances.map((attendance) => attendance.date));

  const entries: DayListEntry[] = attendances.map((attendance) => ({
    kind: "attendance",
    date: attendance.date,
    attendance,
  }));

  for (const [date, reservation] of reservationsByDate) {
    if (!attendanceDates.has(date)) {
      entries.push({ kind: "reservationOnly", date, reservation });
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
