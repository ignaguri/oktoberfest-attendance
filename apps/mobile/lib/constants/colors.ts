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
    300: "#D1D5DB", // gray-300 - disabled track color
    400: "#9CA3AF", // gray-400 - chevron/muted icons
    500: "#6B7280", // gray-500 - default icon color
  },

  // Semantic colors
  error: {
    500: "#EF4444", // red-500
    600: "#DC2626", // red-600 - error icon
  },
} as const;

// Convenience exports for common use cases
export const IconColors = {
  default: Colors.gray[500],
  muted: Colors.gray[400],
  white: Colors.white,
  error: Colors.error[600],
} as const;

export const SwitchColors = {
  trackOn: Colors.primary[500],
  trackOff: Colors.gray[300],
  thumb: Colors.white,
} as const;
