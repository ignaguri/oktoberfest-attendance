/**
 * Wrapped feature shared exports
 */

// Types
export type {
  AnimationConfig,
  ThemeConfig,
  SlideType,
  SlideData,
  SlideConfig,
  IntroSlideContent,
  NumbersSlideContent,
  JourneySlideContent,
  TentExplorerSlideContent,
  PeakMomentSlideContent,
  SocialSlideContent,
  AchievementsSlideContent,
  PersonalitySlideContent,
  RankingsSlideContent,
  ComparisonsSlideContent,
  OutroSlideContent,
} from "./types";
export type { WrappedData, WrappedFestival } from "../schemas/wrapped.schema";
export { resolveWrappedFestivalId } from "./resolve-festival";

// Utilities
export {
  formatWrappedDate,
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatPercentile,
  getFestivalYear,
  calculateTotalPoints,
  prepareTimelineData,
  getTopTents,
  getPersonalityEmoji,
  getTraitEmoji,
  sortAchievements,
  isImprovement,
  calculatePodiumGroupsCount,
  getBestGlobalPosition,
  prepareShareImageData,
} from "./utils";
export type { GlobalPositionCriteria } from "./utils";

// Personality
export type { PersonalityAnalysis } from "./personality";
export { analyzePersonality, getPersonalityDescription, getPersonalityBadge } from "./personality";

// Config
export { WRAPPED_THEME, PERSONALITY_DESCRIPTIONS, RARITY_COLORS, CHART_CONFIG } from "./config";
