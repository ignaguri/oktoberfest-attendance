import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiClient } from "@/lib/api-client";

export const REGISTERED_TOKEN_KEY = "liveActivity.registeredToken";

/** Android registers the device's Expo push token, not a per-surface one. */
export async function registerAndroidToken(
  token: string,
  festivalId: string,
  date: string,
): Promise<void> {
  await apiClient.liveActivity.registerToken({
    platform: "android",
    token,
    apnsEnvironment: null,
    festivalId,
    date,
  });
  await AsyncStorage.setItem(REGISTERED_TOKEN_KEY, token);
}

/**
 * Sign-out calls this while the session is still valid: RLS scopes the delete to the
 * caller, so a row left behind would keep sending this user's pushes to the device.
 */
export async function forgetRegisteredToken(): Promise<void> {
  const token = await AsyncStorage.getItem(REGISTERED_TOKEN_KEY);
  if (!token) {
    return;
  }
  await AsyncStorage.removeItem(REGISTERED_TOKEN_KEY);
  // Best effort: an evicted session can't delete; the server prunes the row at day's end.
  await apiClient.liveActivity.deleteToken(token).catch(() => {});
}
