/**
 * Wrapped utility functions (shared between web and mobile)
 * Helper functions for data transformation and formatting
 */

import { parseISO } from "date-fns";

import { formatLocalized } from "../utils/date-utils";
import type { WrappedData } from "../schemas/wrapped.schema";

/**
 * Format date for display with localization
 */
export function formatWrappedDate(dateString: string): string {
  try {
    return formatLocalized(parseISO(dateString), "d MMMM yyyy");
  } catch {
    return dateString;
  }
}

/** "19 Sep": the chart's axis ends, where the full date would crowd the columns. */
export function formatWrappedShortDate(dateString: string): string {
  try {
    return formatLocalized(parseISO(dateString), "d MMM");
  } catch {
    return dateString;
  }
}

/**
 * Calculate number of groups where user ranked in podium (1st, 2nd, 3rd place)
 */
export function calculatePodiumGroupsCount(data: WrappedData): number {
  return data.socialStats.topRankings.filter((ranking) => ranking.position <= 3).length;
}

/**
 * Get the best (highest) global leaderboard position across all criteria
 * Prefers daysAttended if there's a tie
 */
export type GlobalPositionCriteria = "days_attended" | "total_beers" | "avg_beers";

export function getBestGlobalPosition(data: WrappedData): {
  position: number;
  criteria: GlobalPositionCriteria;
} | null {
  const positions: { position: number; criteria: GlobalPositionCriteria }[] = [];

  if (data.globalLeaderboardPositions.daysAttended !== null) {
    positions.push({
      position: data.globalLeaderboardPositions.daysAttended,
      criteria: "days_attended",
    });
  }

  if (data.globalLeaderboardPositions.totalBeers !== null) {
    positions.push({
      position: data.globalLeaderboardPositions.totalBeers,
      criteria: "total_beers",
    });
  }

  if (data.globalLeaderboardPositions.avgBeers !== null) {
    positions.push({
      position: data.globalLeaderboardPositions.avgBeers,
      criteria: "avg_beers",
    });
  }

  if (positions.length === 0) return null;

  // Find the best (lowest number) position
  const bestPosition = positions.reduce((best, current) => {
    return current.position < best.position ? current : best;
  });

  return bestPosition;
}

/**
 * Prepare data for share image generation
 */
export function prepareShareImageData(data: WrappedData) {
  const podiumGroupsCount = calculatePodiumGroupsCount(data);
  const bestGlobalPosition = getBestGlobalPosition(data);

  return {
    festivalName: data.festivalInfo.name,
    daysAttended: data.basicStats.daysAttended,
    beersDrunk: data.basicStats.totalBeers,
    tentsVisited: data.tentStats.uniqueTents,
    podiumGroupsCount,
    bestGlobalPosition,
  };
}
