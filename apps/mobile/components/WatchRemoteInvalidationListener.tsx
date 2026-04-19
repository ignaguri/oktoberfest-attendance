import { useFestival } from "@prostcounter/shared/contexts";
import { useEffect } from "react";
import { DeviceEventEmitter, Platform } from "react-native";

import { useAuth } from "@/lib/auth/AuthContext";
import { useOfflineSafe } from "@/lib/database/offline-provider";

/**
 * Listens for native events emitted by the paired Apple Watch via
 * WCSession (see WatchSessionBridge.swift, injected through
 * withWatchSessionBridge.js). When the watch logs a drink, we pull
 * from the server so local SQLite and React Query caches reflect the
 * new consumption without waiting for AppState to change.
 */
export function WatchRemoteInvalidationListener() {
  const { sync, isOnline } = useOfflineSafe();
  const { currentFestival } = useFestival();
  const { user } = useAuth();

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const subscription = DeviceEventEmitter.addListener(
      "watchRemoteEvent",
      (payload: { type?: string }) => {
        if (payload?.type !== "drinkLogged") return;
        if (!isOnline || !currentFestival?.id || !user?.id) return;
        sync({
          festivalId: currentFestival.id,
          userId: user.id,
          direction: "pull",
        }).catch(() => {});
      },
    );

    return () => subscription.remove();
  }, [sync, isOnline, currentFestival?.id, user?.id]);

  return null;
}
