import { ErrorCodes } from "@prostcounter/shared/errors";
import { formatDateForDatabase } from "@prostcounter/shared/utils";

import { ValidationError } from "../middleware/error";

export interface FestivalDateRange {
  startDate: string;
  endDate: string;
  timezone: string | null;
}

/**
 * Rejects a write for a day the festival doesn't cover. Backfilling an earlier
 * festival day after it ended is still allowed; logging "today" once the
 * festival is over is not.
 */
export function assertDateWithinFestival(festival: FestivalDateRange, date: string): void {
  if (date < festival.startDate || date > festival.endDate) {
    throw new ValidationError(ErrorCodes.DATE_OUTSIDE_FESTIVAL);
  }
}

/** The festival-local calendar day an instant falls on. */
export function festivalDateOf(festival: FestivalDateRange, instant: Date): string {
  return formatDateForDatabase(instant, festival.timezone ?? undefined);
}
