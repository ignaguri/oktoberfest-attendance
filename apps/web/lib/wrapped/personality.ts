/**
 * Personality calculation logic
 * Determines user's festival personality type based on behavior patterns
 */

import type { WrappedData } from "./types";

export interface PersonalityAnalysis {
  primaryType: string;
  traits: string[];
  score: number; // 0-100 confidence score
}

/**
 * Analyze user behavior and determine personality type
 * This matches the logic from the database function but can be used client-side too
 */
export function analyzePersonality(data: WrappedData): PersonalityAnalysis {
  const { basic_stats, tent_stats, timeline } = data;

  // Use pre-calculated tent diversity percentage from database
  // This is calculated server-side based on the festival's actual tent count
  const tentDiversityPct = tent_stats.tent_diversity_pct;

  const avgBeers = basic_stats.avg_beers;
  const daysAttended = basic_stats.days_attended;
  const totalDays = timeline.length;

  // Calculate variance in daily consumption
  const beerCounts = timeline.map((day) => day.beer_count);
  const variance = calculateVariance(beerCounts);

  // Check if attended first day
  const attendedFirstDay =
    timeline.length > 0 &&
    new Date(timeline[0].date).getTime() ===
      new Date(data.festival_info.start_date).getTime();

  // Determine primary personality type with scoring
  const typeScores = {
    Explorer: tentDiversityPct >= 70 ? 90 : tentDiversityPct,
    Champion: avgBeers >= 8 ? 95 : (avgBeers / 8) * 90,
    Loyalist:
      daysAttended / totalDays >= 0.8 ? 85 : (daysAttended / totalDays) * 80,
    "Social Butterfly": avgBeers <= 3 && daysAttended >= 5 ? 80 : 0,
    Consistent: variance < 2 && timeline.length >= 3 ? 75 : 0,
    "Casual Enjoyer": 50, // Default baseline
  };

  // Get highest scoring type
  const primaryType = Object.entries(typeScores).reduce((a, b) =>
    b[1] > a[1] ? b : a,
  )[0];

  // Build traits array
  const traits: string[] = [];

  if (attendedFirstDay) traits.push("Early Bird");

  if (variance < 2) {
    traits.push("Steady Pace");
  } else {
    traits.push("Variable");
  }

  if (tentDiversityPct >= 50) {
    traits.push("Tent Explorer");
  } else {
    traits.push("Tent Loyalist");
  }

  if (avgBeers >= 6) {
    traits.push("Heavy Hitter");
  } else if (avgBeers >= 4) {
    traits.push("Moderate");
  } else {
    traits.push("Light Drinker");
  }

  return {
    primaryType,
    traits: traits.filter(Boolean),
    score: typeScores[primaryType as keyof typeof typeScores] || 50,
  };
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;

  const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  const squaredDiffs = numbers.map((num) => Math.pow(num - mean, 2));
  const variance =
    squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;

  return Math.sqrt(variance); // Return standard deviation
}

/**
 * Get detailed personality description based on type and traits
 */
export function getPersonalityDescription(
  type: string,
  traits: string[],
): string {
  const baseDescriptions: Record<string, string> = {
    Explorer:
      "You're an adventurer at heart! You explored a wide variety of tents and embraced diverse experiences throughout the festival.",
    Champion:
      "You're a true champion! Your impressive beer consumption shows you really embraced the festival spirit.",
    Loyalist:
      "You're dedicated and consistent! Your frequent attendance demonstrates true festival loyalty.",
    "Social Butterfly":
      "You're here for the vibes! You attended many days while keeping it light, focusing on the social experience.",
    Consistent:
      "You're steady and reliable! Your remarkably consistent pattern shows you know your limits and stick to them.",
    "Casual Enjoyer":
      "You enjoyed the festival at your own pace! A balanced approach to beer and fun.",
  };

  let description =
    baseDescriptions[type] || baseDescriptions["Casual Enjoyer"];

  // Add trait-based additions
  if (traits.includes("Early Bird")) {
    description += " You were there from day one!";
  }

  if (traits.includes("Tent Explorer")) {
    description += " Your tent diversity shows real curiosity.";
  }

  if (traits.includes("Heavy Hitter") && type !== "Champion") {
    description += " You certainly know how to party!";
  }

  return description;
}

/**
 * Get personality badge/icon
 */
export function getPersonalityBadge(type: string): {
  emoji: string;
  color: string;
} {
  const badges: Record<string, { emoji: string; color: string }> = {
    Explorer: { emoji: "🗺️", color: "#10B981" }, // green
    Champion: { emoji: "🏆", color: "#F59E0B" }, // yellow
    Loyalist: { emoji: "💪", color: "#3B82F6" }, // blue
    "Social Butterfly": { emoji: "🦋", color: "#EC4899" }, // pink
    Consistent: { emoji: "📊", color: "#8B5CF6" }, // purple
    "Casual Enjoyer": { emoji: "😎", color: "#6B7280" }, // gray
  };

  return badges[type] || { emoji: "🍺", color: "#F59E0B" };
}
