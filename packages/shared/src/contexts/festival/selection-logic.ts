/**
 * Festival selection logic
 *
 * Determines which festival to select based on priority:
 * 1. Previously stored selection
 * 2. Currently live festival (by date)
 * 3. Nearest upcoming festival
 * 4. Most recent festival
 *
 * festivals.status and is_active are stale in prod, so everything here gates on
 * the dates. "Today" is resolved in each festival's own timezone: endDate is a
 * wall-clock date there, so the last day still counts as live.
 */

import type { Festival } from "../../schemas/festival.schema";
import { formatDateForDatabase } from "../../utils/date-utils";

function todayFor(festival: Festival, now: Date): string {
  return formatDateForDatabase(now, festival.timezone ?? undefined);
}

/** True when today falls within the festival dates, both ends inclusive */
export function isFestivalLive(festival: Festival, now: Date = new Date()): boolean {
  const today = todayFor(festival, now);
  return festival.startDate <= today && today <= festival.endDate;
}

/** True when the festival is live or has not started yet */
export function isFestivalLiveOrUpcoming(festival: Festival, now: Date = new Date()): boolean {
  return todayFor(festival, now) <= festival.endDate;
}

/**
 * Select a festival based on priority rules
 *
 * @param festivals - Array of available festivals (sorted by startDate desc from API)
 * @param storedFestivalId - Previously stored festival ID from persistence
 * @param now - Current time, injectable for tests
 * @returns Selected festival or null if no festivals available
 */
export function selectFestival(
  festivals: Festival[],
  storedFestivalId: string | null,
  now: Date = new Date(),
): Festival | null {
  if (!festivals || festivals.length === 0) {
    return null;
  }

  // Priority 1: Stored festival ID
  if (storedFestivalId) {
    const stored = festivals.find((f) => f.id === storedFestivalId);
    if (stored) {
      return stored;
    }
  }

  // Priority 2: Currently live festival
  const live = festivals.find((f) => isFestivalLive(f, now));
  if (live) {
    return live;
  }

  // Priority 3: Nearest upcoming festival. The list is sorted by startDate desc,
  // so the last upcoming one is the soonest.
  const upcoming = festivals.filter((f) => isFestivalLiveOrUpcoming(f, now));
  if (upcoming.length > 0) {
    return upcoming[upcoming.length - 1];
  }

  // Priority 4: Most recent festival (already sorted by startDate desc from API)
  return festivals[0];
}

/**
 * The live festival to offer when the current one is not live, so a pick made
 * for an earlier festival does not silently stick once a new one starts.
 * Returns null once the user has dismissed the offer for that live festival.
 */
export function getSwitchSuggestion(
  festivals: Festival[],
  currentFestival: Festival | null,
  dismissedFestivalId: string | null,
  now: Date = new Date(),
): Festival | null {
  if (!currentFestival || isFestivalLive(currentFestival, now)) {
    return null;
  }

  const live = festivals.find((f) => isFestivalLive(f, now));
  if (!live || live.id === dismissedFestivalId) {
    return null;
  }

  return live;
}
