/**
 * Wrapped feature types (shared between web and mobile)
 * Provider-agnostic type definitions for the Wrapped slide system
 */

/**
 * Slide type enumeration
 */
export type SlideType =
  | "intro"
  | "numbers"
  | "journey"
  | "tent_explorer"
  | "peak_moment"
  | "social"
  | "achievements"
  | "personality"
  | "rankings"
  | "drink_breakdown"
  | "comparisons"
  | "outro";

/**
 * Generic slide data structure
 */
export interface SlideData {
  type: SlideType;
  content: unknown;
  animations?: AnimationConfig;
  theme: ThemeConfig;
}

/**
 * Slide configuration
 */
export interface SlideConfig {
  id: string;
  type: SlideType;
  title: string;
  subtitle?: string;
  showNavigation?: boolean;
  allowSkip?: boolean;
}

/**
 * Animation configuration
 */
export interface AnimationConfig {
  entrance?: "fade" | "slide" | "zoom" | "none";
  exit?: "fade" | "slide" | "zoom" | "none";
  duration?: number;
  confetti?: boolean;
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
}

/**
 * Slide-specific content types
 */
export interface IntroSlideContent {
  festivalName: string;
  festivalYear: number;
  username: string;
}

export interface NumbersSlideContent {
  totalBeers: number;
  daysAttended: number;
  totalSpent: number;
  avgBeers: number;
}

export interface JourneySlideContent {
  timeline: {
    date: string;
    beerCount: number;
    spent: number;
  }[];
}

export interface TentExplorerSlideContent {
  uniqueTents: number;
  totalTents: number;
  favoriteTent: string | null;
  diversityPct: number;
  tentBreakdown: {
    tentName: string;
    visitCount: number;
  }[];
}

export interface PeakMomentSlideContent {
  bestDay: {
    date: string;
    beerCount: number;
    spent: number;
  } | null;
  maxSingleSession: number;
}

export interface SocialSlideContent {
  groupsJoined: number;
  photosUploaded: number;
  topRankings: {
    groupName: string;
    position: number;
  }[];
  pictures: {
    id: string;
    pictureUrl: string;
    createdAt: string;
    attendanceDate: string;
  }[];
}

export interface AchievementsSlideContent {
  achievements: {
    id: string;
    name: string;
    icon: string;
    rarity: string;
    points: number;
  }[];
  totalPoints: number;
}

export interface PersonalitySlideContent {
  type: string;
  traits: string[];
  description: string;
}

export interface RankingsSlideContent {
  topRankings: {
    groupName: string;
    position: number;
  }[];
}

export interface ComparisonsSlideContent {
  vsAverage: {
    beersDiff: number;
    daysDiff: number;
    avgBeers: number;
    avgDays: number;
  };
  vsLastYear: {
    beersDiff: number;
    daysDiff: number;
    spentDiff: number;
  } | null;
}

export interface OutroSlideContent {
  festivalName: string;
  totalBeers: number;
  daysAttended: number;
  shareUrl: string;
}
