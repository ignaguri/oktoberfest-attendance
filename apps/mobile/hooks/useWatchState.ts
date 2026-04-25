import { useEffect, useState } from "react";
import { DeviceEventEmitter, Platform } from "react-native";

export interface WatchState {
  isPaired: boolean;
  isWatchAppInstalled: boolean;
  isReachable: boolean;
}

/**
 * Subscribes to the `watchState` event emitted by WatchSessionBridge (see
 * apps/mobile/plugins/withWatchSessionBridge.js). Returns null until the
 * bridge has emitted for the first time (activation completes or watch
 * pairing/reachability changes). Always null on Android.
 */
export function useWatchState(): WatchState | null {
  const [state, setState] = useState<WatchState | null>(null);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const subscription = DeviceEventEmitter.addListener(
      "watchState",
      (payload: Partial<WatchState>) => {
        setState({
          isPaired: Boolean(payload.isPaired),
          isWatchAppInstalled: Boolean(payload.isWatchAppInstalled),
          isReachable: Boolean(payload.isReachable),
        });
      },
    );

    return () => subscription.remove();
  }, []);

  return state;
}
