import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import { logger } from "@/lib/logger";

const KEY = "liveActivity.enabled";
const CHANGED_EVENT = "liveActivitySettingChanged";

export async function getLiveActivityEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) !== "false";
}

export async function setLiveActivityEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, enabled ? "true" : "false");
  DeviceEventEmitter.emit(CHANGED_EVENT, enabled);
}

/** Per device, default on. The settings screen and the controller share it. */
export function useLiveActivitySetting(): {
  enabled: boolean;
  loaded: boolean;
  setEnabled(value: boolean): void;
} {
  const [enabled, setEnabledState] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getLiveActivityEnabled()
      .then(setEnabledState)
      .catch((error) => logger.error("[LiveActivity] reading the setting", error))
      .finally(() => setLoaded(true));
    const subscription = DeviceEventEmitter.addListener(CHANGED_EVENT, (value: boolean) => {
      setEnabledState(value);
    });
    return () => subscription.remove();
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    setLoaded(true);
    void setLiveActivityEnabled(value);
  }, []);

  return { enabled, loaded, setEnabled };
}
