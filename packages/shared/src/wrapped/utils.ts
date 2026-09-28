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

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

/**
 * Format number with separator for Germany
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("de-DE").format(num);
}

/**
 * Format percentage with sign
 */
export function formatPercentage(percent: number): string {
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(1)}%`;
}

/**
 * Format a percentile rank for display. Whole numbers read better than decimals
 * here ("better than 86% of attendees"), and the extra precision is meaningless
 * on festivals with only a few dozen attendees.
 */
export function formatPercentile(percent: number): string {
  return `${Math.round(percent)}%`;
}

/**
 * Get festival year from festival name or dates
 */
export function getFestivalYear(festivalInfo: WrappedData["festivalInfo"]): number {
  // Try to extract year from festival name first
  const yearMatch = festivalInfo.name.match(/\d{4}/);
  if (yearMatch) {
    return parseInt(yearMatch[0]);
  }

  // Fall back to start date year
  return new Date(festivalInfo.startDate).getFullYear();
}

/**
 * Calculate total achievement points
 */
export function calculateTotalPoints(achievements: WrappedData["achievements"]): number {
  return achievements.reduce((sum, achievement) => sum + achievement.points, 0);
}

/**
 * Transform wrapped data for timeline chart
 */
export function prepareTimelineData(timeline: WrappedData["timeline"]) {
  return timeline.map((day) => ({
    date: formatLocalized(parseISO(day.date), "d MMMM"),
    fullDate: day.date,
    beers: day.beerCount,
    spent: day.spent,
    tents: day.tentsVisited,
  }));
}

/**
 * Get top N tent visits
 */
export function getTopTents(
  tentBreakdown: WrappedData["tentStats"]["tentBreakdown"],
  limit: number = 5,
) {
  return tentBreakdown.sort((a, b) => b.visitCount - a.visitCount).slice(0, limit);
}

/**
 * Get personality emoji based on type
 */
export function getPersonalityEmoji(type: string): string {
  const emojiMap: Record<string, string> = {
    Explorer: "\u{1F5FA}\u{FE0F}",
    Champion: "\u{1F3C6}",
    Loyalist: "\u{1F4AA}",
    "Social Butterfly": "\u{1F98B}",
    Consistent: "\u{1F4CA}",
    "Casual Enjoyer": "\u{1F60E}",
  };

  return emojiMap[type] || "\u{1F37A}";
}

/**
 * Get trait emoji based on trait name
 */
export function getTraitEmoji(trait: string): string {
  const emojiMap: Record<string, string> = {
    "Early Bird": "\u{1F305}",
    "Steady Pace": "\u{2696}\u{FE0F}",
    Variable: "\u{1F4C8}",
    "Tent Explorer": "\u{1F3AA}",
    "Tent Loyalist": "\u{1F3E0}",
    "Heavy Hitter": "\u{1F4AA}",
    Moderate: "\u{1F44C}",
    "Light Drinker": "\u{1F331}",
  };

  return emojiMap[trait] || "\u{2728}";
}

/**
 * Sort achievements by rarity and points
 */
export function sortAchievements(achievements: WrappedData["achievements"]) {
  const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };

  return [...achievements].sort((a, b) => {
    const rarityDiff =
      rarityOrder[a.rarity as keyof typeof rarityOrder] -
      rarityOrder[b.rarity as keyof typeof rarityOrder];

    if (rarityDiff !== 0) return rarityDiff;

    return b.points - a.points;
  });
}

/**
 * Check if comparison shows improvement vs last year
 */
export function isImprovement(vsLastYear: WrappedData["comparisons"]["vsLastYear"]): {
  beers: boolean;
  days: boolean;
  overall: boolean;
} | null {
  if (!vsLastYear) return null;

  return {
    beers: vsLastYear.beersDiff > 0,
    days: vsLastYear.daysDiff > 0,
    overall: vsLastYear.beersDiff > 0 && vsLastYear.daysDiff >= 0,
  };
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
export function getBestGlobalPosition(data: WrappedData): {
  position: number;
  criteria: string;
} | null {
  const positions = [];

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
