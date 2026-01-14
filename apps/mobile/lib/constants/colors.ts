/**
 * Color constants for use in components where NativeWind classes cannot be applied
 * (e.g., icon `color` props, Switch `trackColor`, etc.)
 *
 * These values mirror the Tailwind/NativeWind color tokens defined in tailwind.config.js
 * Use NativeWind classes whenever possible; only use these constants as a fallback.
 */
export const Colors = {
  // Primary brand colors (yellow)
  primary: {
    500: "#F59E0B", // yellow-500 - main brand color
    600: "#D97706", // yellow-600 - darker brand
  },

  // Neutral colors
  white: "#FFFFFF",
  black: "#000000",

  // Gray scale (for icons, muted elements)
  gray: {
    200: "#E5E7EB", // gray-200 - borders
    300: "#D1D5DB", // gray-300 - disabled track color
    400: "#9CA3AF", // gray-400 - chevron/muted icons
    500: "#6B7280", // gray-500 - default icon color
  },

  // Semantic colors
  error: {
    500: "#EF4444", // red-500
    600: "#DC2626", // red-600 - error icon
  },

  success: {
    500: "#22C55E", // green-500 - success states
  },
} as const;

// Convenience exports for common use cases
export const IconColors = {
  default: Colors.gray[500],
  muted: Colors.gray[400],
  white: Colors.white,
  error: Colors.error[600],
  success: Colors.success[500],
  primary: Colors.primary[500],
  disabled: Colors.gray[300],
} as const;

export const SwitchColors = {
  trackOn: Colors.primary[500],
  trackOff: Colors.gray[300],
  thumb: Colors.white,
} as const;

// For destructive/warning switches (e.g., hide photos)
export const SwitchColorsDestructive = {
  trackOn: Colors.error[500],
  trackOff: Colors.gray[300],
  thumb: Colors.white,
} as const;

// Drink type colors for icons and backgrounds
export const DrinkTypeColors = {
  beer: "#F59E0B", // amber/yellow for beer
  radler: "#84CC16", // lime green for radler (lemon)
  wine: "#A855F7", // purple for wine
  soft_drink: "#78716C", // stone/brown for soft drinks
  alcohol_free: "#38BDF8", // sky-400 (light blue) for alcohol-free
} as const;

// Background colors for UI elements
export const BackgroundColors = {
  50: "#F9FAFB", // bg-background-50
  100: "#F3F4F6", // bg-background-100
  white: "#FFFFFF",
} as const;
