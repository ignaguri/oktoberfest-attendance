import { useEffect, useState } from "react";
import { DeviceEventEmitter, Platform } from "react-native";

export interface WatchStatus {
  isPaired: boolean | null;
  isInstalled: boolean | null;
}

interface WatchStateEvent {
  isPaired?: boolean;
  isWatchAppInstalled?: boolean;
}

/**
 * Subscribes to `watchState` device events emitted by WatchSessionBridge
 * (see apps/mobile/plugins/withWatchSessionBridge.js). Returns the latest
 * pairing / companion-install state for the iPhone.
 *
 * Values are `null` until the first event arrives (the native session
 * activates asynchronously). On non-iOS platforms the values resolve to
 * `false` immediately.
 */
export function useWatchStatus(): WatchStatus {
  const [status, setStatus] = useState<WatchStatus>(() =>
    Platform.OS === "ios"
      ? { isPaired: null, isInstalled: null }
      : { isPaired: false, isInstalled: false },
  );

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const subscription = DeviceEventEmitter.addListener(
      "watchState",
      (payload: WatchStateEvent) => {
        const nextPaired = payload?.isPaired ?? false;
        const nextInstalled = payload?.isWatchAppInstalled ?? false;
        setStatus((prev) =>
          prev.isPaired === nextPaired && prev.isInstalled === nextInstalled
            ? prev
            : { isPaired: nextPaired, isInstalled: nextInstalled },
        );
      },
    );

    return () => subscription.remove();
  }, []);

  return status;
}
