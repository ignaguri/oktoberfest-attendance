/**
 * Wrapped feature types
 * Provider-agnostic type definitions for the Wrapped slide system
 */

import type { ReactNode } from "react";

/**
 * Slide provider interface - allows swapping between web/Remotion/custom providers
 */
export interface ISlideProvider {
  name: "web" | "remotion" | "custom";
  renderSlide: (slideData: SlideData, config: SlideConfig) => ReactNode;
  exportImage?: (slideId: string) => Promise<Blob>;
  exportVideo?: () => Promise<Blob>;
}

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
  | "comparisons"
  | "outro";

/**
 * Generic slide data structure
 */
export interface SlideData {
  type: SlideType;
  content: unknown; // Will be typed specifically per slide
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
  duration?: number; // milliseconds
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
 * Complete wrapped data structure (matches DB function return)
 */
export interface WrappedData {
  user_info: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  festival_info: {
    name: string;
    start_date: string;
    end_date: string;
    location: string;
  };
  basic_stats: {
    total_beers: number;
    days_attended: number;
    avg_beers: number;
    total_spent: number;
    beer_cost: number;
  };
  tent_stats: {
    unique_tents: number;
    favorite_tent: string | null;
    tent_diversity_pct: number;
    tent_breakdown: {
      tent_name: string;
      visit_count: number;
    }[];
  };
  peak_moments: {
    best_day: {
      date: string;
      beer_count: number;
      tents_visited: number;
      spent: number;
    } | null;
    max_single_session: number;
    most_expensive_day: {
      date: string;
      amount: number;
    } | null;
  };
  social_stats: {
    groups_joined: number;
    top_3_rankings: {
      group_name: string;
      position: number;
    }[];
    photos_uploaded: number;
    total_group_members: number;
  };
  global_leaderboard_positions: {
    days_attended: number | null;
    total_beers: number | null;
    avg_beers: number | null;
  };
  achievements: {
    id: string;
    name: string;
    description: string;
    icon: string;
    points: number;
    rarity: string;
    unlocked_at: string;
  }[];
  timeline: {
    date: string;
    beer_count: number;
    spent: number;
    tents_visited: number;
  }[];
  comparisons: {
    vs_festival_avg: {
      beers_diff_pct: number;
      days_diff_pct: number;
      avg_beers: number;
      avg_days: number;
    };
    vs_last_year: {
      beers_diff: number;
      days_diff: number;
      spent_diff: number;
      prev_beers: number;
      prev_days: number;
      prev_festival_name: string;
    } | null;
  };
  personality: {
    type: string;
    traits: string[];
  };
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
    beer_count: number;
    spent: number;
  }[];
}

export interface TentExplorerSlideContent {
  uniqueTents: number;
  totalTents: number;
  favoriteTent: string | null;
  diversityPct: number;
  tentBreakdown: {
    tent_name: string;
    visit_count: number;
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
    group_name: string;
    position: number;
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
    group_name: string;
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

/**
 * Wrapped access control result
 */
export interface WrappedAccessResult {
  allowed: boolean;
  reason?: "not_ended" | "no_data" | "not_authenticated" | "error";
  message?: string;
}

/**
 * Share image options
 */
export interface ShareImageOptions {
  slideId: string;
  format?: "png" | "jpeg";
  quality?: number; // 0-1
  width?: number;
  height?: number;
}
