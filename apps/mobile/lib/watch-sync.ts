import { Platform } from "react-native";

const APP_GROUP = "group.com.prostcounter.shared";

export interface WatchSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  currentFestivalId: string | null;
  expiresAt: number; // unix seconds
}

function getStorage() {
  if (Platform.OS !== "ios") return null;
  // Lazy import so Android/web bundles don't load this
  const { ExtensionStorage } = require("@bacons/apple-targets");
  return new ExtensionStorage(APP_GROUP);
}

export function syncSessionToWatch(params: WatchSession): void {
  const storage = getStorage();
  if (!storage) return;
  storage.set("accessToken", params.accessToken);
  storage.set("refreshToken", params.refreshToken);
  storage.set("userId", params.userId);
  storage.set("currentFestivalId", params.currentFestivalId ?? "");
  storage.set("expiresAt", String(params.expiresAt));
}

export function clearSessionOnWatch(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.set("accessToken", "");
  storage.set("refreshToken", "");
  storage.set("userId", "");
  storage.set("currentFestivalId", "");
  storage.set("expiresAt", "0");
}
