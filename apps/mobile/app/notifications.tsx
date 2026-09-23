import type { Notification } from "@novu/js";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Stack } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";

import { NotificationInbox } from "@/components/notifications/NotificationInbox";
import { defaultScreenOptions } from "@/lib/navigation/header-config";
import { navigateToNotificationRoute } from "@/lib/notifications/handlers";

export default function NotificationsScreen() {
  const { t } = useTranslation();

  const handleNotificationPress = useCallback((notification: Notification) => {
    navigateToNotificationRoute(notification.data ?? {});
  }, []);

  return (
    <View className="flex-1 bg-background-50">
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
