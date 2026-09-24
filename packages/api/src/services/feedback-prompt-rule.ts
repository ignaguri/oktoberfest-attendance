import { formatDateForDatabase, formatTimeInTimezone } from "@prostcounter/shared/utils";

import type { LoggedDay, PromptRecord } from "../repositories/interfaces/feedback.repository";

export const PROMPTS_PER_FESTIVAL = 2;
export const SECOND_PROMPT_MIN_LOGGED_DAYS = 3;
export const PROMPT_SPACING_MS = 48 * 60 * 60 * 1000;
/** Before this festival-local hour, last night still reads as "today". */
export const EARLIEST_PROMPT_HOUR = 7;

/** The calendar day before a YYYY-MM-DD date. */
export function previousDay(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

/**
 * The day to ask about: a logged day that was yesterday on its festival's
 * clock, once that clock reads 07:00 or later. Never today, which may still
 * be going on.
 */
export function pickCandidateDay(now: Date, loggedDays: LoggedDay[]): LoggedDay | null {
  const candidates = loggedDays.filter((loggedDay) => {
    const today = formatDateForDatabase(now, loggedDay.timezone);
    const hour = Number(formatTimeInTimezone(now, loggedDay.timezone, "H"));
    return loggedDay.day === previousDay(today) && hour >= EARLIEST_PROMPT_HOUR;
  });

  if (candidates.length === 0) {
    return null;
  }

  // Two festivals on the same day is close to impossible; pick one the same way every time.
  return [...candidates].sort((a, b) => a.festivalId.localeCompare(b.festivalId))[0];
}

/** The caps: one prompt per day, two per festival, 48h apart. */
export function isPromptAllowed({
  now,
  candidate,
  prompts,
  loggedDaysInFestival,
}: {
  now: Date;
  candidate: LoggedDay;
  prompts: PromptRecord[];
  loggedDaysInFestival: number;
}): boolean {
  const alreadyAsked = prompts.some(
    (record) => record.festivalId === candidate.festivalId && record.day === candidate.day,
  );
  if (alreadyAsked) {
    return false;
  }

  const promptsInFestival = prompts.filter((record) => record.festivalId === candidate.festivalId);
  if (promptsInFestival.length >= PROMPTS_PER_FESTIVAL) {
    return false;
  }
  if (promptsInFestival.length === 1 && loggedDaysInFestival < SECOND_PROMPT_MIN_LOGGED_DAYS) {
    return false;
  }

  const askedRecently = prompts.some(
    (record) => now.getTime() - new Date(record.createdAt).getTime() < PROMPT_SPACING_MS,
  );
  return !askedRecently;
}
