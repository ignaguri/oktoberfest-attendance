/**
 * Wrapped feature shared exports
 */

// Types
export type { AnimationConfig } from "./types";
export type { WrappedData, WrappedFestival } from "../schemas/wrapped.schema";
export { resolveWrappedFestivalId } from "./resolve-festival";

// Utilities
export { formatWrappedDate, getBestGlobalPosition, prepareShareImageData } from "./utils";
export type { GlobalPositionCriteria } from "./utils";

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
  personaName,
  personaSignals,
} from "./story/persona";
export type { StoryAction, StoryState } from "./story/navigation";
export { initialStoryState, REVEAL_STEP_MS, revealDurationMs, storyReducer } from "./story/navigation";
export { countUpValue, useCountUp } from "./story/count-up";
export { useSlideSummary, useStoryCopy, useStoryLanguage, useStoryNumber } from "./story/use-story-copy";
export { type SummaryPart, slideSummaryParts } from "./story/summary";
export { WRAPPED_STORY_THEME } from "./story/theme";
