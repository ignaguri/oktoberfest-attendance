import { useFestival } from "@prostcounter/shared/contexts";
import { useEffect } from "react";
import { DeviceEventEmitter, Platform } from "react-native";

import { useAuth } from "@/lib/auth/AuthContext";
import { useOfflineSafe } from "@/lib/database/offline-provider";
import { clearSessionOnWatch, syncSessionToWatch } from "@/lib/watch-sync";

/**
 * Single integration point for the paired Apple Watch.
 *
 *   1. Sync Supabase session + current festival to the shared App Group
 *      UserDefaults whenever they change (WatchSessionBridge.swift — injected
 *      by withWatchSessionBridge.js — forwards the payload to the watch over
 *      WCSession).
 *   2. Listen for "watchRemoteEvent" device events emitted by the bridge when
 *      the watch logs a drink, and trigger a pull sync so local SQLite and
 *      React Query caches reflect the new consumption without waiting for
 *      AppState to change.
 */
export function WatchBridge() {
  const { session, user } = useAuth();
  const { currentFestival } = useFestival();
  const { sync, isOnline } = useOfflineSafe();

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    if (!session) {
      clearSessionOnWatch();
      return;
    }

    const {
      access_token,
      refresh_token,
      expires_at,
      user: sessionUser,
    } = session;
    if (!access_token || !refresh_token || !sessionUser?.id) return;

    syncSessionToWatch({
      accessToken: access_token,
      refreshToken: refresh_token,
      userId: sessionUser.id,
      currentFestivalId: currentFestival?.id ?? null,
      expiresAt: expires_at ?? 0,
    });
  }, [
    session?.access_token,
    session?.refresh_token,
    session?.expires_at,
    session?.user?.id,
    currentFestival?.id,
  ]);

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
