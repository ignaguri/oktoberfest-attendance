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
  WrappedData,
  WrappedAccessResult,
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

// Utilities
export {
  formatWrappedDate,
  formatCurrency,
  formatNumber,
  formatPercentage,
  getFestivalYear,
  calculateTotalPoints,
  hasWrappedData,
  getComparisonText,
  prepareTimelineData,
  getTopTents,
  generateShareText,
  getPersonalityEmoji,
  getTraitEmoji,
  sortAchievements,
  isImprovement,
  calculatePodiumGroupsCount,
  getBestGlobalPosition,
  prepareShareImageData,
} from "./utils";

// Personality
export type { PersonalityAnalysis } from "./personality";
export {
  analyzePersonality,
  getPersonalityDescription,
  getPersonalityBadge,
} from "./personality";

// Config
export {
  WRAPPED_THEME,
  PERSONALITY_DESCRIPTIONS,
  RARITY_COLORS,
  CHART_CONFIG,
} from "./config";
