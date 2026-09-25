import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { nativeTabBarHeight, tabScreenBottomPadding } from "./tab-bar-layout";

/** Bottom padding for a tab screen's scroll content, clear of the tab bar and FABs. */
export function useTabScreenBottomPadding(): number {
  const insets = useSafeAreaInsets();
  return tabScreenBottomPadding({
    tabBarHeight: nativeTabBarHeight(Platform.OS),
    insetBottom: insets.bottom,
  });
}
