/**
 * Focus Manager Setup for React Query
 *
 * Connects React Native's AppState to React Query's focusManager.
 * This enables refetchOnWindowFocus to work on mobile - when users
 * return to the app from background, stale queries will automatically refetch.
 */

import { focusManager } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import type { AppStateStatus } from "react-native";

/**
 * Hook to setup focus manager for React Query.
 * Call this once in your root component.
 *
 * On web, focusManager works automatically with window focus events.
 * On native, we need to manually connect it to AppState.
 */
export function useFocusManager() {
  useEffect(() => {
    // Skip on web - React Query handles this automatically
    if (Platform.OS === "web") {
      return;
    }

    const subscription = AppState.addEventListener(
      "change",
      (status: AppStateStatus) => {
        // Tell React Query when app is "focused" (active in foreground)
        // This triggers refetchOnWindowFocus for stale queries
        focusManager.setFocused(status === "active");
      },
    );

    return () => subscription.remove();
  }, []);
}
