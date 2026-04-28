/**
 * Share-the-app hook.
 *
 * Wraps React Native's built-in Share API to open the OS share sheet with a
 * localized invitation message and the correct store URL for the platform.
 * Mirrors the web ShareAppButton text but skips the multi-option dialog —
 * the native share sheet already covers WhatsApp, Messages, Mail, etc.
 */

import { useTranslation } from "@prostcounter/shared/i18n";
import { useCallback } from "react";
import { Platform, Share } from "react-native";

import {
  ANDROID_PLAY_STORE_URL,
  IOS_APP_STORE_URL,
} from "@/lib/constants/app-store";
import { logger } from "@/lib/logger";

export function useShareApp() {
  const { t } = useTranslation();

  return useCallback(async () => {
    const message = t("home.shareAppDialog.shareText");
    const title = t("home.shareAppDialog.title");
    const storeUrl = Platform.select({
      ios: IOS_APP_STORE_URL,
      android: ANDROID_PLAY_STORE_URL,
      default: IOS_APP_STORE_URL,
    });

    try {
      await Share.share(
        Platform.OS === "ios"
          ? { message, url: storeUrl, title }
          : { message: `${message} ${storeUrl}`, title },
        { dialogTitle: title },
      );
    } catch (error) {
      logger.error("Failed to open share sheet:", error);
    }
  }, [t]);
}
