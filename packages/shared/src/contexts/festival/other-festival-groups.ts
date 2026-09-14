import type { Festival } from "../../schemas/festival.schema";
import { isFestivalLiveOrUpcoming } from "./selection-logic";

export interface OtherFestivalGroups {
  festival: Festival;
  groupCount: number;
}

/**
 * Festivals other than the current one where the user already has groups.
 *
 * Only live or upcoming festivals are offered: switching to an ended festival
 * is never the fix for "I can't see my groups". Sorted soonest first.
 */
export function getOtherFestivalGroups(
  groups: { festivalId: string }[],
  festivals: Festival[],
  currentFestivalId: string | undefined,
  now: Date = new Date(),
): OtherFestivalGroups[] {
  const countByFestival = new Map<string, number>();
  for (const group of groups) {
    if (group.festivalId !== currentFestivalId) {
      countByFestival.set(group.festivalId, (countByFestival.get(group.festivalId) ?? 0) + 1);
    }
  }

  return festivals
    .filter((f) => countByFestival.has(f.id) && isFestivalLiveOrUpcoming(f, now))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((festival) => ({ festival, groupCount: countByFestival.get(festival.id) ?? 0 }));
}
