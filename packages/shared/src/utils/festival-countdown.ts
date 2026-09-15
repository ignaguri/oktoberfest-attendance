import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays, parseISO } from "date-fns";

import { TIMEZONE } from "../constants/app";
import type { Festival } from "../schemas/festival.schema";
import { formatDateForDatabase } from "./date-utils";

/** Local hour at which a festival opens (the first keg is tapped at noon) */
export const FESTIVAL_OPENING_HOUR = 12;

export type FestivalDates = Pick<Festival, "startDate" | "endDate" | "timezone">;

export type FestivalCountdownPhase = "upcoming" | "live" | "ended";

export interface CountdownRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface FestivalCountdown {
  phase: FestivalCountdownPhase;
  remaining: CountdownRemaining | null;
  isOpeningDay: boolean;
  currentDay: number | null;
  totalDays: number;
}

const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;

function instantInTimezone(date: string, hour: number, timezone: string, dayOffset = 0): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(new TZDate(year, month - 1, day + dayOffset, hour, 0, 0, timezone).getTime());
}

function splitRemaining(milliseconds: number): CountdownRemaining {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  return {
    days: Math.floor(totalSeconds / SECONDS_PER_DAY),
    hours: Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR),
    minutes: Math.floor((totalSeconds % SECONDS_PER_HOUR) / 60),
    seconds: totalSeconds % 60,
  };
}

export function getFestivalCountdown(festival: FestivalDates, now: Date = new Date()): FestivalCountdown {
  const timezone = festival.timezone ?? TIMEZONE;
  const opensAt = instantInTimezone(festival.startDate, FESTIVAL_OPENING_HOUR, timezone);
  const endsAt = instantInTimezone(festival.endDate, 0, timezone, 1);
  const today = formatDateForDatabase(now, timezone);
  const isOpeningDay = today === festival.startDate;
  const totalDays =
    differenceInCalendarDays(parseISO(festival.endDate), parseISO(festival.startDate)) + 1;

  if (now.getTime() < opensAt.getTime()) {
    return {
      phase: "upcoming",
      remaining: splitRemaining(opensAt.getTime() - now.getTime()),
      isOpeningDay,
      currentDay: null,
      totalDays,
    };
  }

  if (now.getTime() < endsAt.getTime()) {
    return {
      phase: "live",
      remaining: null,
      isOpeningDay,
      currentDay: differenceInCalendarDays(parseISO(today), parseISO(festival.startDate)) + 1,
      totalDays,
    };
  }

  return { phase: "ended", remaining: null, isOpeningDay: false, currentDay: null, totalDays };
}

/** "Oktoberfest 2025" -> "oktoberfest" */
export function getFestivalSeriesKey(name: string): string {
  return name.replace(/\s+\d{4}\s*$/, "").trim().toLowerCase();
}

export function getPreviousFestivalInSeries(
  festival: Festival,
  festivals: Festival[],
): Festival | null {
  const seriesKey = getFestivalSeriesKey(festival.name);
  const earlierInSeries = festivals
    .filter(
      (candidate) =>
        candidate.id !== festival.id &&
        candidate.startDate < festival.startDate &&
        getFestivalSeriesKey(candidate.name) === seriesKey,
    )
    .sort((first, second) => second.startDate.localeCompare(first.startDate));

  return earlierInSeries[0] ?? null;
}
