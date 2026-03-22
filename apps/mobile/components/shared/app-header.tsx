import { useTranslation } from "@prostcounter/shared/i18n";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { Image, View } from "react-native";

import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Colors, IconColors } from "@/lib/constants/colors";
import { useCounts } from "@/lib/notifications/NovuProvider";

const logoImage = require("@/assets/images/logo.png");

/**
 * App header component displaying the ProstCounter logo and name,
 * with a notification bell icon on the right.
 */
export function AppHeader() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between px-2 py-2">
      {/* Spacer for centering */}
      <View style={{ width: 40 }} />

      {/* Centered logo + name */}
      <View className="flex-row items-center gap-3">
        <Image
          source={logoImage}
          style={{ width: 64, height: 64 }}
          resizeMode="contain"
          alt=""
          accessibilityLabel={t("app.logo")}
        />
        <View className="flex-row">
          <Text className="text-3xl font-extrabold text-primary-600">
            {t("app.namePart1")}
          </Text>
          <Text className="text-3xl font-extrabold text-primary-500">
            {t("app.namePart2")}
          </Text>
        </View>
      </View>

      {/* Bell icon */}
      <NotificationBell onPress={() => router.push("/notifications")} />
    </View>
  );
}

function NotificationBell({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { counts } = useCounts({ filters: [{ read: false }] });
  const unreadCount = counts?.[0]?.count ?? 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={t("notifications.title")}
      className="relative p-2"
    >
      <Bell size={24} color={IconColors.default} />
      {unreadCount > 0 && (
        <View
          className="absolute -right-0.5 -top-0.5 items-center justify-center rounded-full"
          style={{
            backgroundColor: Colors.primary[500],
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
          }}
        >
          <Text className="text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

AppHeader.displayName = "AppHeader";
