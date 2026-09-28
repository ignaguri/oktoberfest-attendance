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

// Story
export type {
  BadgesSlide,
  BigNumberSlide,
  CompareSlide,
  CopyRef,
  DaysSlide,
  DrinksSlide,
  MeanwhileSlide,
  PeopleSlide,
  PersonaSlide,
  ProstSlide,
  ServusSlide,
  StorySlide,
  StorySlideKind,
  StorySlideOf,
  TentsSlide,
  WiesnAndYouSlide,
} from "./story/types";
export type { WrappedOfficialStats, CuriousFind } from "../schemas/wrapped.schema";
export { buildWrappedStory, TINY_FESTIVAL_ATTENDEES } from "./story/build-story";
export type { Persona, PersonaId, PersonaSignals } from "./story/persona";
export {
  derivePersona,
  festivalDayCount,
  formatHour,
  PERSONA_CREST_FILES,
  PERSONA_IDS,
  PERSONA_NAMES,
  personaSignals,
} from "./story/persona";
export type { StoryAction, StoryState } from "./story/navigation";
export { initialStoryState, REVEAL_STEP_MS, revealDurationMs, storyReducer } from "./story/navigation";
export { countUpValue, useCountUp } from "./story/count-up";
export { useStoryCopy, useStoryLanguage, useStoryNumber } from "./story/use-story-copy";
export { WRAPPED_STORY_THEME } from "./story/theme";
