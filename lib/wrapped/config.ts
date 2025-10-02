/**
 * Wrapped feature configuration
 * Centralized configuration for slides, themes, and animations
 */

import type { SlideConfig, ThemeConfig, AnimationConfig } from "./types";

/**
 * Brand theme configuration (yellow theme)
 */
export const WRAPPED_THEME: ThemeConfig = {
  primaryColor: "#F59E0B", // yellow-500
  secondaryColor: "#D97706", // yellow-600
  backgroundColor: "#FFFFFF",
  textColor: "#1F2937", // gray-800
};

/**
 * Default animation configurations
 */
export const DEFAULT_ANIMATION: AnimationConfig = {
  entrance: "fade",
  exit: "fade",
  duration: 500,
  confetti: false,
};

export const CELEBRATION_ANIMATION: AnimationConfig = {
  entrance: "zoom",
  exit: "fade",
  duration: 700,
  confetti: true,
};

/**
 * Slide configurations
 * Defines the order and settings for all wrapped slides
 */
export const SLIDE_CONFIGS: SlideConfig[] = [
  {
    id: "intro",
    type: "intro",
    title: "Your Festival Wrapped",
    showNavigation: true,
    allowSkip: false,
  },
  {
    id: "numbers",
    type: "numbers",
    title: "Your Festival in Numbers",
    subtitle: "Let's break down your experience",
    showNavigation: true,
    allowSkip: true,
  },
  {
    id: "journey",
    type: "journey",
    title: "Your Beer Journey",
    subtitle: "Day by day progression",
    showNavigation: true,
    allowSkip: true,
  },
  {
    id: "tent_explorer",
    type: "tent_explorer",
    title: "Tent Explorer",
    subtitle: "Where did you drink?",
    showNavigation: true,
    allowSkip: true,
  },
  {
    id: "peak_moment",
    type: "peak_moment",
    title: "Peak Moments",
    subtitle: "Your best day at the festival",
    showNavigation: true,
    allowSkip: true,
  },
  {
    id: "social",
    type: "social",
    title: "Social Butterfly",
    subtitle: "Groups and photos",
    showNavigation: true,
    allowSkip: true,
  },
  {
    id: "achievements",
    type: "achievements",
    title: "Achievement Unlocked",
    subtitle: "Badges you've earned",
    showNavigation: true,
    allowSkip: true,
  },
  {
    id: "personality",
    type: "personality",
    title: "Your Festival Personality",
    subtitle: "Based on your patterns",
    showNavigation: true,
    allowSkip: true,
  },
  {
    id: "rankings",
    type: "rankings",
    title: "Group Rankings",
    subtitle: "Where you placed",
    showNavigation: true,
    allowSkip: true,
  },
  {
    id: "comparisons",
    type: "comparisons",
    title: "How You Compare",
    subtitle: "vs Average & Last Year",
    showNavigation: true,
    allowSkip: true,
  },
  {
    id: "outro",
    type: "outro",
    title: "See You Next Year",
    subtitle: "Share your wrapped!",
    showNavigation: true,
    allowSkip: false,
  },
];

/**
 * Personality type descriptions
 */
export const PERSONALITY_DESCRIPTIONS: Record<string, string> = {
  Explorer:
    "You're an adventurer at heart! You explored most tents and tried different experiences throughout the festival.",
  Champion:
    "You're a true champion! Your beer consumption was impressive and you really embraced the festival spirit.",
  Loyalist:
    "You're dedicated and consistent! You attended most days and showed true festival loyalty.",
  "Social Butterfly":
    "You're here for the vibes! You attended many days but kept it light, focusing on the social experience.",
  Consistent:
    "You're steady and reliable! Your consumption pattern was remarkably consistent throughout the festival.",
  "Casual Enjoyer":
    "You enjoyed the festival at your own pace! A balanced approach to beer and fun.",
};

/**
 * Rarity color mapping for achievements
 */
export const RARITY_COLORS: Record<string, string> = {
  common: "#9CA3AF", // gray-400
  rare: "#60A5FA", // blue-400
  epic: "#A78BFA", // purple-400
  legendary: "#FBBF24", // yellow-400
};

/**
 * Chart configuration for timeline visualization
 */
export const CHART_CONFIG = {
  colors: {
    primary: "#F59E0B", // yellow-500
    secondary: "#D97706", // yellow-600
    grid: "#E5E7EB", // gray-200
    text: "#6B7280", // gray-500
  },
  dimensions: {
    height: 300,
    margin: { top: 20, right: 30, left: 20, bottom: 50 },
  },
};

/**
 * Share image configuration
 */
export const SHARE_IMAGE_CONFIG = {
  width: 1080, // Instagram story size
  height: 1920,
  format: "png" as const,
  quality: 0.95,
};

/**
 * Access control configuration
 */
export const ACCESS_CONFIG = {
  allowInDev: true,
  requireFestivalEnded: true,
  minAttendanceDays: 0, // Minimum days to generate wrapped (0 = allow even with no attendance)
};

/**
 * Animation timing constants
 */
export const ANIMATION_DELAYS = {
  confettiTrigger: 500, // ms delay before triggering confetti
  confettiTriggerPeak: 700, // ms delay for peak moment confetti
  copyButtonReset: 3000, // ms delay before resetting copy button text
} as const;
