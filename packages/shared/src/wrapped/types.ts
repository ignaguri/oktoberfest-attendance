/**
 * Wrapped feature types (shared between web and mobile)
 */

/**
 * Animation configuration
 */
export interface AnimationConfig {
  entrance?: "fade" | "slide" | "zoom" | "none";
  exit?: "fade" | "slide" | "zoom" | "none";
  duration?: number;
  confetti?: boolean;
}
