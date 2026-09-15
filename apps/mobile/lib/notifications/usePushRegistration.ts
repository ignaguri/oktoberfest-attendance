import {
  useCurrentProfile,
  useEnablePushNotifications,
  useUpdateNotificationPreferences,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { splitFullName } from "@prostcounter/shared/utils";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { getAvatarUrl } from "@/lib/image-urls";
import { logger } from "@/lib/logger";
import { useNotificationContextSafe } from "@/lib/notifications/NotificationContext";

/**
 * Registers this device's Expo push token with Novu and marks push as enabled.
 *
 * Does not ask for OS permission: callers request it first. This used to live
 * only in the settings screen, so accepting the launch prompt got a token but
 * never registered it, and almost nobody could receive pushes.
 */
export function usePushRegistration() {
  const { t } = useTranslation();
  const { registerForPushNotifications, markAsRegisteredWithNovu } = useNotificationContextSafe();
  const enablePush = useEnablePushNotifications();
  const updatePreferences = useUpdateNotificationPreferences();
  const { data: profile } = useCurrentProfile();
  const [isRegistering, setIsRegistering] = useState(false);

  const register = useCallback(
    async (options: { silent?: boolean } = {}): Promise<boolean> => {
      const isSilent = options.silent ?? false;
      setIsRegistering(true);

      try {
        const token = await registerForPushNotifications();
        if (!token) {
          logger.error("[Push] No token returned from registerForPushNotifications");
          if (!isSilent) {
            Alert.alert(t("common.status.error"), t("profile.notifications.noToken"));
          }
          return false;
        }

        const fullAvatarUrl = getAvatarUrl(profile?.avatar_url);
        const { firstName, lastName } = splitFullName(profile?.full_name);

        const enableResult = await enablePush.mutateAsync({
          token,
          ...(profile?.email && { email: profile.email }),
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(fullAvatarUrl && { avatar: fullAvatarUrl }),
        });

        if (!enableResult.success) {
          const errorMessage = enableResult.error || "Unknown error";
          logger.error("[Push] enablePush failed: " + errorMessage);
          if (!isSilent) {
            Alert.alert(
              t("common.status.error"),
              `Failed to enable push notifications: ${errorMessage}`,
            );
          }
          return false;
        }

        markAsRegisteredWithNovu();
        await updatePreferences.mutateAsync({ pushEnabled: true });
        logger.info("[Push] Push notifications enabled");
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("[Push] Exception: " + errorMessage);
        if (!isSilent) {
          Alert.alert(
            t("common.status.error"),
            `Failed to enable push notifications: ${errorMessage}`,
          );
        }
        return false;
      } finally {
        setIsRegistering(false);
      }
    },
    [enablePush, markAsRegisteredWithNovu, profile, registerForPushNotifications, t, updatePreferences],
  );

  return { register, isRegistering };
}
