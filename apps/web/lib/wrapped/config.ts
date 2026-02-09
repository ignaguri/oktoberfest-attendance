/**
 * Web-specific wrapped configuration
 * Animation and share image configs that are specific to the web implementation
 */

import type { AnimationConfig } from "@prostcounter/shared/wrapped";

/**
 * Default animation configurations (web-specific, uses framer-motion)
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
 * Share image configuration (web DOM-specific)
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
  allowedUsers: [
    "af1a053c-8b7d-42db-ae61-4d358e93fed0", // Ahmad
    "0297b925-716f-4658-8286-bb8913522793", // Fede Pollo
    "69d1594d-b923-4700-aa80-7a625dc99885", // Edu
    "0c97626e-d930-4b66-96cc-92d49a7ff8a5", // Yo
  ], // Users who are allowed to access wrapped
};

/**
 * Animation timing constants
 */
export const ANIMATION_DELAYS = {
  confettiTrigger: 500, // ms delay before triggering confetti
  confettiTriggerPeak: 700, // ms delay for peak moment confetti
  copyButtonReset: 3000, // ms delay before resetting copy button text
} as const;
