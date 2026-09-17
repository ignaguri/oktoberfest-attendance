/**
 * What the attendance screen does with a `?date=` deep link, such as a friend's
 * plan overlap push.
 *
 * Festivals can share dates, so a link that names its festival must open the
 * day there: opened in another festival, a save would file the plan under it.
 *
 * Lives in `lib` so vitest can reach it; see ./day-list-entries for why.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DayLinkAction<TFestival> =
  | { action: "none" }
  | { action: "open"; date: string }
  | { action: "switch"; festival: TFestival }
  | { action: "wait" }
  | { action: "drop" };

export function resolveDayLink<TFestival extends { id: string }>({
  date,
  festivalId,
  currentFestivalId,
  festivals,
  festivalsLoading,
}: {
  date: string | undefined;
  festivalId: string | undefined;
  currentFestivalId: string | undefined;
  festivals: TFestival[];
  festivalsLoading: boolean;
}): DayLinkAction<TFestival> {
  if (!date || !DATE_PATTERN.test(date)) {
    return { action: "none" };
  }

  if (!festivalId || festivalId === currentFestivalId) {
    return { action: "open", date };
  }

  const festival = festivals.find((candidate) => candidate.id === festivalId);
  if (festival) {
    return { action: "switch", festival };
  }

  return festivalsLoading ? { action: "wait" } : { action: "drop" };
}
