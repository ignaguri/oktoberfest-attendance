import type { Festival } from "../schemas/festival.schema";
import { getFestivalStatus } from "./festival-status";

export interface GroupedFestivals {
  active: Festival[];
  upcoming: Festival[];
  past: Festival[];
}

/**
 * Split festivals into active / upcoming / past and sort each group for display.
 *
 * Active and upcoming are ordered soonest-first; past is ordered
 * most-recently-ended first. Dates are `YYYY-MM-DD` strings, so string
 * comparison is already chronological.
 */
export function groupFestivalsByStatus(
  festivals: Festival[],
  now: Date = new Date(),
): GroupedFestivals {
  const active: Festival[] = [];
  const upcoming: Festival[] = [];
  const past: Festival[] = [];

  for (const festival of festivals) {
    const status = getFestivalStatus(festival, now);

    if (status === "active") {
      active.push(festival);
    } else if (status === "upcoming") {
      upcoming.push(festival);
    } else {
      past.push(festival);
    }
  }

  active.sort((a, b) => a.startDate.localeCompare(b.startDate));
  upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
  past.sort((a, b) => b.endDate.localeCompare(a.endDate));

  return { active, upcoming, past };
}
