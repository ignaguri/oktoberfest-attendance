import { eachDayOfInterval, getDay, isAfter, startOfDay } from "date-fns";

/** A single day inside the festival window. */
export interface FestivalDayCell {
  date: Date;
  /** True on the 1st of a month, used to render a month label on the cell. */
  isFirstOfMonth: boolean;
}

/**
 * Build weekday-aligned rows covering exactly the festival window.
 *
 * Slots before the first festival day and after the last are `null` — they
 * render as empty space rather than as faded adjacent-month dates, because
 * those days are not part of the festival.
 *
 * Every returned row has exactly 7 entries.
 */
export function buildFestivalWeeks({
  startDate,
  endDate,
  weekStartsOn,
}: {
  startDate: Date;
  endDate: Date;
  weekStartsOn: 0 | 1;
}): (FestivalDayCell | null)[][] {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);

  if (isAfter(start, end)) {
    return [];
  }

  const days = eachDayOfInterval({ start, end });
  const leadingBlankCount = (getDay(start) - weekStartsOn + 7) % 7;

  const cells: (FestivalDayCell | null)[] = [
    ...Array.from({ length: leadingBlankCount }, () => null),
    ...days.map((date) => ({ date, isFirstOfMonth: date.getDate() === 1 })),
  ];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (FestivalDayCell | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return weeks;
}
