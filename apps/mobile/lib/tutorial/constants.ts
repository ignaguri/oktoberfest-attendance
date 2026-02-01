/**
 * Tutorial constants for timing, sizing, and styling
 */

// Timing constants (in milliseconds)
export const TUTORIAL_TIMING = {
  /** Delay before auto-starting tutorial for new users */
  AUTO_START_DELAY: 1500,
  /** Duration for spotlight animation */
  SPOTLIGHT_ANIMATION_DURATION: 300,
  /** Duration for tooltip fade animation */
  TOOLTIP_ANIMATION_DURATION: 200,
  /** Delay between step transitions */
  STEP_TRANSITION_DELAY: 100,
} as const;

// Sizing constants
export const TUTORIAL_SIZING = {
  /** Padding around spotlight target */
  SPOTLIGHT_PADDING: 12,
  /** Border radius for spotlight window */
  SPOTLIGHT_BORDER_RADIUS: 12,
  /** Width of pulsing highlight border */
  SPOTLIGHT_BORDER_WIDTH: 3,
  /** Minimum width for tooltip card */
  TOOLTIP_MIN_WIDTH: 280,
  /** Maximum width for tooltip card */
  TOOLTIP_MAX_WIDTH: 340,
  /** Margin from screen edges */
  TOOLTIP_SCREEN_MARGIN: 16,
  /** Gap between spotlight and tooltip */
  TOOLTIP_SPOTLIGHT_GAP: 12,
} as const;

// Opacity constants
export const TUTORIAL_OPACITY = {
  /** Background overlay opacity (0-1) */
  OVERLAY_OPACITY: 0.7,
} as const;

// Z-index constants for layering
export const TUTORIAL_Z_INDEX = {
  /** Z-index for the overlay backdrop */
  OVERLAY: 1000,
  /** Z-index for the tooltip card (above overlay) */
  TOOLTIP: 1001,
} as const;
