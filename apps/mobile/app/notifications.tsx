import type { Notification } from "@novu/js";
import { getNotificationRoute } from "@prostcounter/shared/constants";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Stack, useRouter } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";

import { NotificationInbox } from "@/components/notifications/NotificationInbox";
import { defaultScreenOptions } from "@/lib/navigation/header-config";

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      const payload = notification.data ?? {};
      const route = getNotificationRoute(payload);

      if (route) {
        router.push(route as never);
      }
    },
    [router],
  );

  return (
    <View className="bg-background-50 flex-1">
      <Stack.Screen
        options={{
          ...defaultScreenOptions,
          title: t("profile.notifications.title"),
          headerShown: true,
        }}
      />
      <NotificationInbox onNotificationPress={handleNotificationPress} />
    </View>
  );
}
