import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Colors, IconColors, SwitchColors } from "@/lib/constants/colors";
import { Bell, Clock, Info, Trophy, Users } from "lucide-react-native";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";

interface NotificationPreferences {
  reminders_enabled: boolean;
  achievement_notifications_enabled: boolean;
  group_notifications_enabled: boolean;
}

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    reminders_enabled: true,
    achievement_notifications_enabled: true,
    group_notifications_enabled: true,
  });

  const fetchPreferences = useCallback(async () => {
    try {
      // TODO: Replace with actual API call when endpoint is available
      // const { preferences: data } = await apiClient.notifications.getPreferences();
      // setPreferences(data);

      // For now, use default values
      setPreferences({
        reminders_enabled: true,
        achievement_notifications_enabled: true,
        group_notifications_enabled: true,
      });
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchPreferences();
  }, [fetchPreferences]);

  const handleToggle = async (
    key: keyof NotificationPreferences,
    value: boolean,
  ) => {
    const previousValue = preferences[key];

    // Optimistic update
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setIsSaving(true);

    try {
      // TODO: Replace with actual API call when endpoint is available
      // await apiClient.notifications.updatePreferences({ [key]: value });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      // Revert on error
      setPreferences((prev) => ({ ...prev, [key]: previousValue }));
      Alert.alert(
        t("common.status.error"),
        t("profile.notifications.updateError"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View className="bg-background-50 flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  return (
    <ScrollView
      className="bg-background-50 flex-1"
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <View className="p-4">
        {/* Preferences Section */}
        <View className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <Text className="text-typography-900 mb-4 text-lg font-semibold">
            {t("profile.notifications.preferences")}
          </Text>

          {/* Reminders */}
          <View className="border-outline-100 flex-row items-center justify-between border-b py-3">
            <View className="flex-1 flex-row items-center gap-3">
              <Clock size={24} color={IconColors.default} />
              <View className="flex-1">
                <Text className="text-typography-900">
                  {t("profile.notifications.reminders")}
                </Text>
                <Text className="text-typography-500 text-sm">
                  {t("profile.notifications.remindersDescription")}
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.reminders_enabled}
              onValueChange={(value) =>
                handleToggle("reminders_enabled", value)
              }
              disabled={isSaving}
              trackColor={{
                false: SwitchColors.trackOff,
                true: SwitchColors.trackOn,
              }}
              thumbColor={SwitchColors.thumb}
            />
          </View>

          {/* Achievement Notifications */}
          <View className="border-outline-100 flex-row items-center justify-between border-b py-3">
            <View className="flex-1 flex-row items-center gap-3">
              <Trophy size={24} color={IconColors.default} />
              <View className="flex-1">
                <Text className="text-typography-900">
                  {t("profile.notifications.achievements")}
                </Text>
                <Text className="text-typography-500 text-sm">
                  {t("profile.notifications.achievementsDescription")}
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.achievement_notifications_enabled}
              onValueChange={(value) =>
                handleToggle("achievement_notifications_enabled", value)
              }
              disabled={isSaving}
              trackColor={{
                false: SwitchColors.trackOff,
                true: SwitchColors.trackOn,
              }}
              thumbColor={SwitchColors.thumb}
            />
          </View>

          {/* Group Notifications */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-1 flex-row items-center gap-3">
              <Users size={24} color={IconColors.default} />
              <View className="flex-1">
                <Text className="text-typography-900">
                  {t("profile.notifications.groups")}
                </Text>
                <Text className="text-typography-500 text-sm">
                  {t("profile.notifications.groupsDescription")}
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.group_notifications_enabled}
              onValueChange={(value) =>
                handleToggle("group_notifications_enabled", value)
              }
              disabled={isSaving}
              trackColor={{
                false: SwitchColors.trackOff,
                true: SwitchColors.trackOn,
              }}
              thumbColor={SwitchColors.thumb}
            />
          </View>
        </View>

        {/* Push Notifications Section */}
        <View className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <Text className="text-typography-900 mb-4 text-lg font-semibold">
            {t("profile.notifications.pushTitle")}
          </Text>

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-1 flex-row items-center gap-3">
              <Bell size={24} color={IconColors.default} />
              <View className="flex-1">
                <Text className="text-typography-900">
                  {t("profile.notifications.push")}
                </Text>
                <Text className="text-typography-500 text-sm">
                  {t("profile.notifications.pushDescription")}
                </Text>
              </View>
            </View>
            <Switch
              value={false}
              onValueChange={() => {
                Alert.alert(
                  t("common.status.info"),
                  t("profile.notifications.pushComingSoon"),
                );
              }}
              trackColor={{
                false: SwitchColors.trackOff,
                true: SwitchColors.trackOn,
              }}
              thumbColor={SwitchColors.thumb}
            />
          </View>
        </View>

        {/* Info */}
        <View className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
          <View className="flex-row items-start gap-3">
            <Info size={24} color={Colors.primary[600]} />
            <Text className="flex-1 text-sm text-yellow-800">
              {t("profile.notifications.info")}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
