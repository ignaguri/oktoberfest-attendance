import {
  useCurrentProfile,
  useNotificationPreferences,
  useRegisterFCMToken,
  useSubscribeToNotifications,
  useUpdateNotificationPreferences,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Bell, Clock, ExternalLink, Trophy, Users } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";

import { NotificationPermissionPrompt } from "@/components/notifications/NotificationPermissionPrompt";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Colors, IconColors, SwitchColors } from "@/lib/constants/colors";
import { useNotificationContextSafe } from "@/lib/notifications/NotificationContext";

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();

  // Notification context for permission status
  const {
    permissionStatus,
    isPermissionLoading,
    requestPermission,
    registerForPushNotifications,
    markAsRegisteredWithNovu,
    expoPushToken,
  } = useNotificationContextSafe();

  // Shared hooks for preferences
  const {
    data: preferences,
    loading: isLoadingPreferences,
    refetch,
    isRefetching,
  } = useNotificationPreferences();

  const updatePreferences = useUpdateNotificationPreferences();

  // Hooks for Novu registration
  const registerToken = useRegisterFCMToken();
  const subscribeToNotifications = useSubscribeToNotifications();

  // Get current user profile
  const { data: profile } = useCurrentProfile();

  // Local state for permission prompt
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  // Track if registration is in progress
  const [isEnabling, setIsEnabling] = useState(false);

  const isLoading = isLoadingPreferences || isPermissionLoading;

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Map API response to local format
  const mappedPreferences = {
    reminders_enabled: preferences?.remindersEnabled ?? true,
    achievement_notifications_enabled:
      preferences?.achievementNotificationsEnabled ?? true,
    group_notifications_enabled: preferences?.groupNotificationsEnabled ?? true,
    push_enabled: preferences?.pushEnabled ?? false,
  };

  const handleToggle = async (
    key:
      | "reminders_enabled"
      | "achievement_notifications_enabled"
      | "group_notifications_enabled",
    value: boolean,
  ) => {
    // Map snake_case to camelCase for API
    const apiKeyMap: Record<string, string> = {
      reminders_enabled: "remindersEnabled",
      achievement_notifications_enabled: "achievementNotificationsEnabled",
      group_notifications_enabled: "groupNotificationsEnabled",
    };

    const apiKey = apiKeyMap[key] as
      | "remindersEnabled"
      | "achievementNotificationsEnabled"
      | "groupNotificationsEnabled";

    try {
      await updatePreferences.mutateAsync({ [apiKey]: value });
    } catch (error) {
      Alert.alert(
        t("common.status.error", { defaultValue: "Error" }),
        t("profile.notifications.updateError", {
          defaultValue: "Failed to update notification settings",
        }),
      );
    }
  };

  const handlePushToggle = async (value: boolean) => {
    if (value) {
      // User wants to enable push notifications
      if (permissionStatus === "undetermined") {
        // Show our custom prompt first
        setShowPermissionPrompt(true);
      } else if (permissionStatus === "denied") {
        // Permission was denied, direct to settings
        Alert.alert(
          t("profile.notifications.permissionDenied", {
            defaultValue: "Notifications Disabled",
          }),
          t("profile.notifications.openSettings", {
            defaultValue:
              "To enable notifications, please go to your device settings and allow notifications for ProstCounter.",
          }),
          [
            {
              text: t("common.action.cancel", { defaultValue: "Cancel" }),
              style: "cancel",
            },
            {
              text: t("profile.notifications.goToSettings", {
                defaultValue: "Open Settings",
              }),
              onPress: () => {
                if (Platform.OS === "ios") {
                  Linking.openURL("app-settings:");
                } else {
                  Linking.openSettings();
                }
              },
            },
          ],
        );
      } else if (permissionStatus === "granted") {
        // Permission already granted, just register
        await enablePushNotifications();
      }
    } else {
      // User wants to disable push notifications
      try {
        await updatePreferences.mutateAsync({ pushEnabled: false });
      } catch (error) {
        Alert.alert(
          t("common.status.error", { defaultValue: "Error" }),
          t("profile.notifications.updateError", {
            defaultValue: "Failed to update notification settings",
          }),
        );
      }
    }
  };

  const enablePushNotifications = async () => {
    setIsEnabling(true);

    try {
      // Step 1: Request iOS permission
      const granted = await requestPermission();
      if (!granted) {
        setIsEnabling(false);
        return;
      }

      // Step 2: Register for push notifications to get the Expo push token
      // registerForPushNotifications now returns the token directly
      const token = await registerForPushNotifications();
      if (!token) {
        Alert.alert(
          t("common.status.error", { defaultValue: "Error" }),
          t("profile.notifications.noToken", {
            defaultValue:
              "Failed to get push notification token. Please try again.",
          }),
        );
        setIsEnabling(false);
        return;
      }

      // Step 3: Subscribe user to Novu (creates subscriber)
      const subscribeResult = await subscribeToNotifications.mutateAsync({
        email: profile?.email,
        firstName: profile?.full_name?.split(" ")[0],
        lastName: profile?.full_name?.split(" ").slice(1).join(" "),
        avatar: profile?.avatar_url || undefined,
      });

      if (!subscribeResult.success) {
        console.error(
          "Failed to subscribe to Novu:",
          subscribeResult.error || "Unknown error",
        );
        Alert.alert(
          t("common.status.error", { defaultValue: "Error" }),
          t("profile.notifications.subscribeFailed", {
            defaultValue: "Failed to register with notification service.",
          }),
        );
        setIsEnabling(false);
        return;
      }

      // Step 4: Register token with Novu
      const tokenResult = await registerToken.mutateAsync(token);

      if (!tokenResult.success || !tokenResult.novuRegistered) {
        console.error(
          "Failed to register token with Novu:",
          tokenResult.error || "Unknown error",
        );
        Alert.alert(
          t("common.status.error", { defaultValue: "Error" }),
          t("profile.notifications.tokenRegistrationFailed", {
            defaultValue: "Failed to register device for push notifications.",
          }),
        );
        setIsEnabling(false);
        return;
      }

      // Mark as registered with Novu in context
      markAsRegisteredWithNovu();

      // Step 5: Update preferences to enable push
      await updatePreferences.mutateAsync({ pushEnabled: true });

      console.log("Successfully enabled push notifications");
    } catch (error) {
      console.error("Error enabling push notifications:", error);
      Alert.alert(
        t("common.status.error", { defaultValue: "Error" }),
        t("profile.notifications.enableFailed", {
          defaultValue:
            "Failed to enable push notifications. Please try again.",
        }),
      );
    } finally {
      setIsEnabling(false);
    }
  };

  if (isLoading) {
    return (
      <View className="bg-background-50 flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  // Push is enabled if device permission is granted AND backend preference is true
  // Both conditions must be met for the switch to show ON
  const isPushEnabled =
    permissionStatus === "granted" && (preferences?.pushEnabled ?? false);
  const isSaving = updatePreferences.loading || isEnabling;

  return (
    <>
      <ScrollView
        className="bg-background-50 flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching ?? false}
            onRefresh={onRefresh}
          />
        }
      >
        <View className="p-4">
          {/* Preferences Section */}
          <View className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
            <Text className="text-typography-900 mb-4 text-lg font-semibold">
              {t("profile.notifications.preferences", {
                defaultValue: "Notification Preferences",
              })}
            </Text>

            {/* Reminders */}
            <View className="border-outline-100 flex-row items-center justify-between border-b py-3">
              <View className="flex-1 flex-row items-center gap-3">
                <Clock size={24} color={IconColors.default} />
                <View className="flex-1">
                  <Text className="text-typography-900">
                    {t("profile.notifications.reminders", {
                      defaultValue: "Reminders",
                    })}
                  </Text>
                  <Text className="text-typography-500 text-sm">
                    {t("profile.notifications.remindersDescription", {
                      defaultValue:
                        "Reservation reminders and check-in prompts",
                    })}
                  </Text>
                </View>
              </View>
              <Switch
                value={mappedPreferences.reminders_enabled}
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
                    {t("profile.notifications.achievements", {
                      defaultValue: "Achievement Notifications",
                    })}
                  </Text>
                  <Text className="text-typography-500 text-sm">
                    {t("profile.notifications.achievementsDescription", {
                      defaultValue: "Get notified when you unlock achievements",
                    })}
                  </Text>
                </View>
              </View>
              <Switch
                value={mappedPreferences.achievement_notifications_enabled}
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
                    {t("profile.notifications.groups", {
                      defaultValue: "Group Notifications",
                    })}
                  </Text>
                  <Text className="text-typography-500 text-sm">
                    {t("profile.notifications.groupsDescription", {
                      defaultValue:
                        "Get notifications from your groups (check-ins, achievements, etc.)",
                    })}
                  </Text>
                </View>
              </View>
              <Switch
                value={mappedPreferences.group_notifications_enabled}
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
              {t("profile.notifications.pushTitle", {
                defaultValue: "Push Notifications",
              })}
            </Text>

            <View className="flex-row items-center justify-between py-3">
              <View className="flex-1 flex-row items-center gap-3">
                <Bell size={24} color={IconColors.default} />
                <View className="flex-1">
                  <Text className="text-typography-900">
                    {t("profile.notifications.push", {
                      defaultValue: "Push Notifications",
                    })}
                  </Text>
                  <Text className="text-typography-500 text-sm">
                    {t("profile.notifications.pushDescription", {
                      defaultValue:
                        "Receive notifications even when the app is closed",
                    })}
                  </Text>
                </View>
              </View>
              <Switch
                value={isPushEnabled}
                onValueChange={handlePushToggle}
                disabled={isSaving}
                trackColor={{
                  false: SwitchColors.trackOff,
                  true: SwitchColors.trackOn,
                }}
                thumbColor={SwitchColors.thumb}
              />
            </View>

            {/* Permission Status Indicator */}
            {permissionStatus === "denied" && (
              <View className="mt-2 flex-row items-center gap-2 rounded-lg bg-yellow-50 p-3">
                <ExternalLink size={16} color={Colors.primary[600]} />
                <Text className="flex-1 text-sm text-yellow-800">
                  {t("profile.notifications.permissionDeniedHint", {
                    defaultValue:
                      "Notifications are disabled. Tap the toggle to open settings.",
                  })}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Permission Prompt Modal */}
      <NotificationPermissionPrompt
        isOpen={showPermissionPrompt}
        onClose={() => setShowPermissionPrompt(false)}
        onEnable={enablePushNotifications}
        onSkip={() => {
          // User skipped, don't change anything
        }}
      />
    </>
  );
}
