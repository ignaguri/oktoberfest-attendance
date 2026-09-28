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
 * Animation timing constants
 */
export const ANIMATION_DELAYS = {
  confettiTrigger: 500, // ms delay before triggering confetti
  confettiTriggerPeak: 700, // ms delay for peak moment confetti
  copyButtonReset: 3000, // ms delay before resetting copy button text
} as const;
