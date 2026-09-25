/**
 * Geometry of the bottom of a tab screen. The native tab bar and the floating
 * FAB group both sit over the scroll content, so a fixed `pb-20` was shorter
 * than the tab bar alone on Android and left the feed's last row (the Load
 * more button) underneath it.
 */

/** Height of the native tab bar: `Platform.OS === "android" ? 100 : 50`. */
export function nativeTabBarHeight(platformOs: string): number {
  return platformOs === "android" ? 100 : 50;
}

interface BottomLayout {
  tabBarHeight: number;
  insetBottom: number;
}

/** Distance from the screen bottom to the FAB group in `app/(tabs)/_layout.tsx`. */
export function fabBottomOffset({ tabBarHeight, insetBottom }: BottomLayout): number {
  const margin = insetBottom === 0 ? 40 : 24;
  return tabBarHeight + margin + insetBottom;
}

// A large Gluestack FAB, plus breathing room above it
const FAB_CLEARANCE = 56 + 16;

/** Bottom padding that lets a tab screen's last row scroll clear of the FABs. */
export function tabScreenBottomPadding(layout: BottomLayout): number {
  return fabBottomOffset(layout) + FAB_CLEARANCE;
}
