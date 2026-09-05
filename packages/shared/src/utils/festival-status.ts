import { endOfDay, isBefore, isWithinInterval, parseISO } from "date-fns";

import type { Festival, FestivalStatus } from "../schemas/festival.schema";

export function getFestivalStatus(festival: Festival, now: Date = new Date()): FestivalStatus {
  const startDate = parseISO(festival.startDate);
  const endDate = endOfDay(parseISO(festival.endDate));

  if (isBefore(now, startDate)) return "upcoming";
  if (isWithinInterval(now, { start: startDate, end: endDate })) return "active";
  return "ended";
}
