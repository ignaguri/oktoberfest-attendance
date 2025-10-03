/**
 * Wrapped utility functions
 * Helper functions for data transformation and formatting
 */

import { format, parseISO } from "date-fns";

import type { WrappedData } from "./types";

/**
 * Format date for display
 */
export function formatWrappedDate(dateString: string): string {
  try {
    return format(parseISO(dateString), "d MMMM yyyy");
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
 * Get festival year from festival name or dates
 */
export function getFestivalYear(
  festivalInfo: WrappedData["festival_info"],
): number {
  // Try to extract year from festival name first
  const yearMatch = festivalInfo.name.match(/\d{4}/);
  if (yearMatch) {
    return parseInt(yearMatch[0]);
  }

  // Fall back to start date year
  return new Date(festivalInfo.start_date).getFullYear();
}

/**
 * Calculate total achievement points
 */
export function calculateTotalPoints(
  achievements: WrappedData["achievements"],
): number {
  return achievements.reduce((sum, achievement) => sum + achievement.points, 0);
}

/**
 * Check if user has data to show wrapped
 */
export function hasWrappedData(data: WrappedData | null): boolean {
  if (!data) return false;

  return (
    data.basic_stats.total_beers > 0 ||
    data.basic_stats.days_attended > 0 ||
    data.achievements.length > 0
  );
}

/**
 * Get comparison text for vs average
 */
export function getComparisonText(
  diffPct: number,
  metric: "beers" | "days",
): string {
  if (Math.abs(diffPct) < 5) {
    return `About average`;
  }

  const direction = diffPct > 0 ? "more" : "fewer";
  const metricText = metric === "beers" ? "beers" : "days";

  return `${Math.abs(diffPct).toFixed(0)}% ${direction} ${metricText} than average`;
}

/**
 * Transform wrapped data for timeline chart
 */
export function prepareTimelineData(timeline: WrappedData["timeline"]) {
  return timeline.map((day) => ({
    date: format(parseISO(day.date), "d MMMM"),
    fullDate: day.date,
    beers: day.beer_count,
    spent: day.spent,
    tents: day.tents_visited,
  }));
}

/**
 * Get top N tent visits
 */
export function getTopTents(
  tentBreakdown: WrappedData["tent_stats"]["tent_breakdown"],
  limit: number = 5,
) {
  return tentBreakdown
    .sort((a, b) => b.visit_count - a.visit_count)
    .slice(0, limit);
}

/**
 * Generate share text for social media
 */
export function generateShareText(data: WrappedData): string {
  const year = getFestivalYear(data.festival_info);
  const { total_beers, days_attended } = data.basic_stats;

  return (
    `My ${data.festival_info.name} Wrapped 🍻\n\n` +
    `${total_beers} beers across ${days_attended} days!\n` +
    `Festival personality: ${data.personality.type}\n\n` +
    `#Oktoberfest${year} #ProstCounter`
  );
}

/**
 * Get personality emoji based on type
 */
export function getPersonalityEmoji(type: string): string {
  const emojiMap: Record<string, string> = {
    Explorer: "🗺️",
    Champion: "🏆",
    Loyalist: "💪",
    "Social Butterfly": "🦋",
    Consistent: "📊",
    "Casual Enjoyer": "😎",
  };

  return emojiMap[type] || "🍺";
}

/**
 * Get trait emoji based on trait name
 */
export function getTraitEmoji(trait: string): string {
  const emojiMap: Record<string, string> = {
    "Early Bird": "🌅",
    "Steady Pace": "⚖️",
    Variable: "📈",
    "Tent Explorer": "🎪",
    "Tent Loyalist": "🏠",
    "Heavy Hitter": "💪",
    Moderate: "👌",
    "Light Drinker": "🌱",
  };

  return emojiMap[trait] || "✨";
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
export function isImprovement(
  vsLastYear: WrappedData["comparisons"]["vs_last_year"],
): {
  beers: boolean;
  days: boolean;
  overall: boolean;
} | null {
  if (!vsLastYear) return null;

  return {
    beers: vsLastYear.beers_diff > 0,
    days: vsLastYear.days_diff > 0,
    overall: vsLastYear.beers_diff > 0 && vsLastYear.days_diff >= 0,
  };
}

/**
 * Calculate number of groups where user ranked in podium (1st, 2nd, 3rd place)
 */
export function calculatePodiumGroupsCount(data: WrappedData): number {
  return data.social_stats.top_3_rankings.filter(
    (ranking) => ranking.position <= 3,
  ).length;
}

/**
 * Get the best (highest) global leaderboard position across all criteria
 * Prefers days_attended if there's a tie
 */
export function getBestGlobalPosition(data: WrappedData): {
  position: number;
  criteria: string;
} | null {
  const positions = [];

  if (data.global_leaderboard_positions.days_attended !== null) {
    positions.push({
      position: data.global_leaderboard_positions.days_attended,
      criteria: "days_attended",
    });
  }

  if (data.global_leaderboard_positions.total_beers !== null) {
    positions.push({
      position: data.global_leaderboard_positions.total_beers,
      criteria: "total_beers",
    });
  }

  if (data.global_leaderboard_positions.avg_beers !== null) {
    positions.push({
      position: data.global_leaderboard_positions.avg_beers,
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
    festivalName: data.festival_info.name,
    daysAttended: data.basic_stats.days_attended,
    beersDrunk: data.basic_stats.total_beers,
    tentsVisited: data.tent_stats.unique_tents,
    podiumGroupsCount,
    bestGlobalPosition,
  };
}
