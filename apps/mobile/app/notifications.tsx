import type { Notification } from "@novu/js";
import { getNotificationRoute } from "@prostcounter/shared/constants";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NotificationInbox } from "@/components/notifications/NotificationInbox";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { IconColors } from "@/lib/constants/colors";

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
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center border-b border-outline-100 px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={24} color={IconColors.default} />
        </Pressable>
        <Text className="text-lg font-semibold text-typography-900">
          {t("profile.notifications.title")}
        </Text>
      </View>

      {/* Inbox */}
      <NotificationInbox onNotificationPress={handleNotificationPress} />
    </SafeAreaView>
  );
}
