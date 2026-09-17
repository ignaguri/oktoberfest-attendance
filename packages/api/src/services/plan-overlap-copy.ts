import type { DayPlanKind } from "@prostcounter/shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });
const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function utcMidnight(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/**
 * "today", "tomorrow", "on Saturday" within the week, then "on Sep 30".
 *
 * Both arguments are festival-local YYYY-MM-DD strings, so the arithmetic runs
 * on UTC midnights and never meets a timezone.
 */
export function formatOverlapDayLabel(date: string, today: string): string {
  const daysAhead = Math.round((utcMidnight(date) - utcMidnight(today)) / DAY_MS);
  const day = new Date(utcMidnight(date));

  if (daysAhead === 0) {
    return "today";
  }
  if (daysAhead === 1) {
    return "tomorrow";
  }
  if (daysAhead > 1 && daysAhead <= 6) {
    return `on ${WEEKDAY.format(day)}`;
  }
  return `on ${MONTH_DAY.format(day)}`;
}

export function buildOverlapBody({
  actorName,
  kind,
  tentName,
  dayLabel,
}: {
  actorName: string;
  kind: DayPlanKind;
  tentName: string | null;
  dayLabel: string;
}): string {
  if (kind === "reservation" && tentName) {
    return `${actorName} reserved ${tentName} ${dayLabel}`;
  }
  return `${actorName} is going ${dayLabel} too`;
}
