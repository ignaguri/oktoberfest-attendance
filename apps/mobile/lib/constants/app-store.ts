import { Platform } from "react-native";

export const IOS_APP_STORE_URL = "https://apps.apple.com/app/id6758376527";

export const ANDROID_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.prostcounter.app";

/** Public store URL for the current platform; resolved once at module load. */
export const APP_STORE_URL =
  Platform.select({
    ios: IOS_APP_STORE_URL,
    android: ANDROID_PLAY_STORE_URL,
  }) ?? IOS_APP_STORE_URL;
