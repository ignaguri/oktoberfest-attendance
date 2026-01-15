/**
 * Online Manager Setup for React Query
 *
 * Connects React Native's NetInfo to React Query's onlineManager.
 * This enables better offline handling - queries pause when offline
 * and resume automatically when connectivity is restored.
 */

import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Hook to setup online manager for React Query.
 * Call this once in your root component.
 *
 * On web, onlineManager works automatically with navigator.onLine.
 * On native, we need to manually connect it to NetInfo.
 */
export function useOnlineManager() {
  useEffect(() => {
    // Skip on web - React Query handles this automatically
    if (Platform.OS === "web") {
      return;
    }

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Update React Query's online status based on connectivity
      // If we can't determine connectivity, assume online
      onlineManager.setOnline(
        state.isConnected === null ? true : state.isConnected,
      );
    });

    return () => unsubscribe();
  }, []);
}
