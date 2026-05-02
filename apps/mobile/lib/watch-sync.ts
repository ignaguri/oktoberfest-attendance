import { DeviceEventEmitter, Platform } from "react-native";

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
function setIfChanged(storage: ExtensionStorageLike, key: string, value: string): void {
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

/**
 * Mirrors the user's selected language to the watch via App Group UserDefaults.
 * The watch reads this on launch and overrides `AppleLanguages` so String Catalog
 * lookups resolve against the chosen locale. Changes made while the watch app is
 * running take effect on its next cold start (AppleLanguages is bundle-level).
 */
export function syncLanguageToWatch(lang: string): void {
  const storage = getStorage();
  if (!storage) return;
  setIfChanged(storage, "preferredLanguage", lang);
}

/**
 * Re-push the session to the watch, bypassing the native bridge's dedupe cache.
 * Token keys still go through `setIfChanged` (avoid five redundant
 * UserDefaults.didChangeNotification wake-ups when nothing actually moved); the
 * bypass comes from bumping `forceSyncNonce`, which the bridge observes to
 * clear its `lastPayload` and re-deliver. Use when the watch appears stuck on
 * the empty-session screen despite the phone being signed in.
 */
export function forceSyncSessionToWatch(params: WatchSession): void {
  const storage = getStorage();
  if (!storage) return;
  setIfChanged(storage, "accessToken", params.accessToken);
  setIfChanged(storage, "refreshToken", params.refreshToken);
  setIfChanged(storage, "userId", params.userId);
  setIfChanged(storage, "currentFestivalId", params.currentFestivalId ?? "");
  setIfChanged(storage, "expiresAt", String(params.expiresAt));
  storage.set("forceSyncNonce", String(Date.now()));
}

export type PingWatchResult = "pong" | "timeout" | "no-storage";

/**
 * Round-trip connection test. Writes `pingNonce` → native bridge sends
 * `{type: "ping", nonce}` over WCSession → watch replies `{type: "pong", nonce}`
 * → native bridge re-emits as `watchRemoteEvent`. Resolves when the matching
 * pong arrives, or on timeout.
 */
export function pingWatch(timeoutMs = 3000): Promise<PingWatchResult> {
  const storage = getStorage();
  if (!storage) return Promise.resolve("no-storage");

  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: PingWatchResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription.remove();
      resolve(result);
    };

    const subscription = DeviceEventEmitter.addListener(
      "watchRemoteEvent",
      (event: { type?: string; nonce?: string }) => {
        if (event?.type === "pong" && event?.nonce === nonce) {
          settle("pong");
        }
      },
    );

    const timer = setTimeout(() => settle("timeout"), timeoutMs);

    storage.set("pingNonce", nonce);
  });
}
