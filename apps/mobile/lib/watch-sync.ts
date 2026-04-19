import { Platform } from "react-native";

const APP_GROUP = "group.com.prostcounter.shared";

export interface WatchSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  currentFestivalId: string | null;
  expiresAt: number; // unix seconds
}

interface ExtensionStorageLike {
  set(key: string, value: string): void;
  get(key: string): string | null;
}

function getStorage(): ExtensionStorageLike | null {
  if (Platform.OS !== "ios") return null;
  // Lazy import so Android/web bundles don't load this
  const { ExtensionStorage } = require("@bacons/apple-targets");
  return new ExtensionStorage(APP_GROUP);
}

/**
 * Each set() writes to App Group UserDefaults, which fires
 * UserDefaults.didChangeNotification on iOS. The WatchSessionBridge
 * observer (see withWatchSessionBridge.js) then runs forwardToWatch —
 * so blindly writing all five keys wakes the bridge up to five times
 * per sync. Skip writes where the value already matches.
 */
function setIfChanged(
  storage: ExtensionStorageLike,
  key: string,
  value: string,
): void {
  if (storage.get(key) === value) return;
  storage.set(key, value);
}

export function syncSessionToWatch(params: WatchSession): void {
  const storage = getStorage();
  if (!storage) return;
  setIfChanged(storage, "accessToken", params.accessToken);
  setIfChanged(storage, "refreshToken", params.refreshToken);
  setIfChanged(storage, "userId", params.userId);
  setIfChanged(storage, "currentFestivalId", params.currentFestivalId ?? "");
  setIfChanged(storage, "expiresAt", String(params.expiresAt));
}

export function clearSessionOnWatch(): void {
  const storage = getStorage();
  if (!storage) return;
  setIfChanged(storage, "accessToken", "");
  setIfChanged(storage, "refreshToken", "");
  setIfChanged(storage, "userId", "");
  setIfChanged(storage, "currentFestivalId", "");
  setIfChanged(storage, "expiresAt", "0");
}
