/**
 * Tutorial system constants
 * Centralized configuration for delays, timeouts, and positioning values
 */

export const TUTORIAL_CONSTANTS = {
  // Timing and delays
  AUTO_START_DELAY: 1000, // Delay before auto-starting tutorial for new users
  RENDER_DELAY: 50, // Delay before recalculating position after render
  SCROLL_DEBOUNCE: 120, // Debounce time for scroll events
  SCROLL_END_TIMEOUT: 100, // Timeout for detecting scroll end
  SCROLL_FALLBACK_TIMEOUT: 1000, // Fallback timeout for scroll completion
  STEP_DELAY_DEFAULT: 0, // Default delay for tutorial steps

  // Positioning and sizing
  TOOLTIP_DEFAULT_WIDTH: 320,
  TOOLTIP_DEFAULT_HEIGHT: 200,
  TOOLTIP_PADDING: 16,
  TOOLTIP_OFFSET: 16, // Distance from target element
  SPOTLIGHT_BORDER_OFFSET: 4, // Border offset around highlighted element
  SPOTLIGHT_GRADIENT_OFFSET: 8, // Gradient offset for spotlight effect
  SPOTLIGHT_GRADIENT_FADE: 12, // Gradient fade distance

  // Scroll positioning
  SCROLL_TOP_PADDING: 150, // Padding for top position scrolling
  SCROLL_BOTTOM_RATIO: 0.7, // Viewport ratio for bottom position
  SCROLL_SIDE_RATIO: 0.4, // Viewport ratio for side positions
} as const;
