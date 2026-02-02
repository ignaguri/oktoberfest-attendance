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
import { logger } from "@/lib/logger";
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
        t("common.status.error"),
        t("profile.notifications.updateError"),
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
          t("profile.notifications.permissionDenied"),
          t("profile.notifications.openSettings"),
          [
            {
              text: t("common.action.cancel"),
              style: "cancel",
            },
            {
              text: t("profile.notifications.goToSettings"),
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
          t("common.status.error"),
          t("profile.notifications.updateError"),
        );
      }
    }
  };

  const enablePushNotifications = async () => {
    setIsEnabling(true);

    try {
      // Step 1: Request iOS permission
      logger.info("[Push] Step 1: Requesting iOS permission...");
      const granted = await requestPermission();
      if (!granted) {
        logger.info("[Push] Step 1 failed: Permission not granted");
        setIsEnabling(false);
        return;
      }
      logger.info("[Push] Step 1 complete: Permission granted");

      // Step 2: Register for push notifications to get the Expo push token
      // registerForPushNotifications now returns the token directly
      logger.info("[Push] Step 2: Getting Expo push token...");
      const token = await registerForPushNotifications();
      if (!token) {
        logger.error("[Push] Step 2 failed: No token returned");
        Alert.alert(
          t("common.status.error"),
          t("profile.notifications.noToken"),
        );
        setIsEnabling(false);
        return;
      }
      logger.info(
        "[Push] Step 2 complete: Token obtained: " +
          token.substring(0, 30) +
          "...",
      );

      // Step 3: Subscribe user to Novu (creates subscriber)
      logger.info("[Push] Step 3: Subscribing to Novu...");
      const subscribePayload = {
        ...(profile?.email && { email: profile.email }),
        ...(profile?.full_name?.split(" ")[0] && {
          firstName: profile.full_name.split(" ")[0],
        }),
        ...(profile?.full_name?.split(" ").slice(1).join(" ") && {
          lastName: profile.full_name.split(" ").slice(1).join(" "),
        }),
        ...(profile?.avatar_url && { avatar: profile.avatar_url }),
      };
      logger.info(
        "[Push] Subscribe payload: " + JSON.stringify(subscribePayload),
      );
      const subscribeResult =
        await subscribeToNotifications.mutateAsync(subscribePayload);

      if (!subscribeResult.success) {
        const errorMsg = subscribeResult.error || "Unknown error";
        logger.error("[Push] Step 3 failed: " + errorMsg);
        Alert.alert(t("common.status.error"), `Subscribe failed: ${errorMsg}`);
        setIsEnabling(false);
        return;
      }
      logger.info("[Push] Step 3 complete: Subscribed to Novu");

      // Step 4: Register token with Novu
      logger.info("[Push] Step 4: Registering token with Novu...");
      const tokenResult = await registerToken.mutateAsync(token);

      if (!tokenResult.success || !tokenResult.novuRegistered) {
        const errorMsg = tokenResult.error || "Unknown error";
        logger.error("[Push] Step 4 failed: " + errorMsg);
        Alert.alert(
          t("common.status.error"),
          `Token registration failed: ${errorMsg}`,
        );
        setIsEnabling(false);
        return;
      }
      logger.info("[Push] Step 4 complete: Token registered with Novu");

      // Mark as registered with Novu in context
      markAsRegisteredWithNovu();

      // Step 5: Update preferences to enable push
      logger.info("[Push] Step 5: Updating preferences...");
      await updatePreferences.mutateAsync({ pushEnabled: true });

      logger.info("[Push] All steps complete: Push notifications enabled!");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("[Push] Exception: " + errorMessage);
      Alert.alert(
        t("common.status.error"),
        `Failed to enable push notifications: ${errorMessage}`,
      );
    } finally {
      setIsEnabling(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
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
        className="flex-1 bg-background-50"
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
            <Text className="mb-4 text-lg font-semibold text-typography-900">
              {t("profile.notifications.preferences")}
            </Text>

            {/* Reminders */}
            <View className="flex-row items-center justify-between border-b border-outline-100 py-3">
              <View className="flex-1 flex-row items-center gap-3">
                <Clock size={24} color={IconColors.default} />
                <View className="flex-1">
                  <Text className="text-typography-900">
                    {t("profile.notifications.reminders")}
                  </Text>
                  <Text className="text-sm text-typography-500">
                    {t("profile.notifications.remindersDescription")}
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
            <View className="flex-row items-center justify-between border-b border-outline-100 py-3">
              <View className="flex-1 flex-row items-center gap-3">
                <Trophy size={24} color={IconColors.default} />
                <View className="flex-1">
                  <Text className="text-typography-900">
                    {t("profile.notifications.achievements")}
                  </Text>
                  <Text className="text-sm text-typography-500">
                    {t("profile.notifications.achievementsDescription")}
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
                    {t("profile.notifications.groups")}
                  </Text>
                  <Text className="text-sm text-typography-500">
                    {t("profile.notifications.groupsDescription")}
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
            <Text className="mb-4 text-lg font-semibold text-typography-900">
              {t("profile.notifications.pushTitle")}
            </Text>

            <View className="flex-row items-center justify-between py-3">
              <View className="flex-1 flex-row items-center gap-3">
                <Bell size={24} color={IconColors.default} />
                <View className="flex-1">
                  <Text className="text-typography-900">
                    {t("profile.notifications.push")}
                  </Text>
                  <Text className="text-sm text-typography-500">
                    {t("profile.notifications.pushDescription")}
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
                  {t("profile.notifications.permissionDeniedHint")}
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
