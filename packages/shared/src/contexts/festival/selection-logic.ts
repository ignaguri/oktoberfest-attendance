/**
 * Festival selection logic
 *
 * Determines which festival to select based on priority:
 * 1. Previously stored selection
 * 2. Currently active by date range
 * 3. Festival marked as active
 * 4. Most recent festival
 */

import { parseISO } from "date-fns";

import type { Festival } from "../../schemas/festival.schema";

/**
 * Select a festival based on priority rules
 *
 * @param festivals - Array of available festivals (sorted by startDate desc from API)
 * @param storedFestivalId - Previously stored festival ID from persistence
 * @returns Selected festival or null if no festivals available
 */
export function selectFestival(
  festivals: Festival[],
  storedFestivalId: string | null,
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

  // Priority 2: Currently active festival (by date)
  // Use parseISO to avoid UTC timezone issues with date-only strings
  const today = new Date();
  const dateMatch = festivals.find((f) => {
    const start = parseISO(f.startDate);
    const end = parseISO(f.endDate);
    return today >= start && today <= end;
  });
  if (dateMatch) {
    return dateMatch;
  }

  // Priority 3: Festival marked as active
  const activeMatch = festivals.find((f) => f.isActive);
  if (activeMatch) {
    return activeMatch;
  }

  // Priority 4: Most recent festival (already sorted by startDate desc from API)
  return festivals[0];
}
