import { endOfDay, isBefore, isWithinInterval, parseISO } from "date-fns";

import type { Festival, FestivalStatus } from "../schemas/festival.schema";

function isFestivalActive(festival: Festival): boolean {
  const now = new Date();
  const startDate = parseISO(festival.startDate);
  const endDate = endOfDay(parseISO(festival.endDate));

  return isWithinInterval(now, { start: startDate, end: endDate });
}

function isFestivalUpcoming(festival: Festival): boolean {
  const now = new Date();
  const startDate = parseISO(festival.startDate);

  return isBefore(now, startDate);
}

export function getFestivalStatus(festival: Festival): FestivalStatus {
  if (isFestivalUpcoming(festival)) return "upcoming";
  if (isFestivalActive(festival)) return "active";
  return "ended";
}
