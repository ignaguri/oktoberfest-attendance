"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useNotifications } from "@/contexts/NotificationContext";
import { useTranslation } from "@/lib/i18n/client";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function NotificationSettings() {
  const { t } = useTranslation();
  const {
    preferences,
    updatePreferences,
    pushSupported,
    pushPermission,
    requestPushPermission,
    loading,
  } = useNotifications();

  const [isUpdating, setIsUpdating] = useState(false);

  if (loading || !preferences) {
    return (
      <div className="card">
        <h3 className="py-2 text-2xl font-black text-gray-800">
          {t("notificationSettings.title")}
        </h3>
        <div className="flex justify-center py-4">
          <div className="text-gray-500">{t("common.status.loading")}</div>
        </div>
      </div>
    );
  }

  const handleToggle = async (
    key: keyof typeof preferences,
    value: boolean,
  ) => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      await updatePreferences({ [key]: value });
      toast.success(t("notifications.success.settingsUpdated"), {
        description: t("notifications.descriptions.settingsUpdated"),
      });
    } catch {
      toast.error(t("common.status.error"), {
        description: t("notificationSettings.errors.updateFailed"),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRequestPushPermission = async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const granted = await requestPushPermission();
      if (granted) {
        toast.success(t("notifications.success.pushEnabled"), {
          description: t("notifications.descriptions.pushEnabled"),
        });
      } else {
        toast.error(t("notifications.error.permissionDenied"), {
          description: t("notifications.descriptions.permissionDenied"),
        });
      }
    } catch (error: any) {
      toast.error(t("common.status.error"), {
        description:
          error.message || t("notificationSettings.errors.pushFailed"),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="card">
      <h3 className="py-2 text-xl font-black text-gray-800">
        {t("notificationSettings.title")}
      </h3>

      <div className="flex flex-col gap-6">
        {/* Consolidated Notification Preferences */}
        <div className="flex flex-col gap-4">
          <h4 className="text-lg font-semibold text-gray-700">
            {t("notificationSettings.preferences")}
          </h4>

          {/* Reminders */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="font-medium">
                  {t("notificationSettings.reminders")}
                </span>
              </div>
              <p className="text-left text-sm text-gray-600">
                {t("notificationSettings.description.reminders")}
              </p>
            </div>
            <Switch
              aria-label={t("notificationSettings.reminders")}
              checked={preferences.reminders_enabled ?? true}
              onCheckedChange={(checked) =>
                handleToggle("reminders_enabled", checked)
              }
              disabled={isUpdating}
            />
          </div>

          {/* Achievement Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="font-medium">
                  {t("notificationSettings.achievementNotifications")}
                </span>
              </div>
              <p className="text-left text-sm text-gray-600">
                {t("notificationSettings.description.achievements")}
              </p>
            </div>
            <Switch
              aria-label={t("notificationSettings.achievementNotifications")}
              checked={preferences.achievement_notifications_enabled ?? true}
              onCheckedChange={(checked) =>
                handleToggle("achievement_notifications_enabled", checked)
              }
              disabled={isUpdating}
            />
          </div>

          {/* Group Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="font-medium">
                  {t("notificationSettings.groupNotifications")}
                </span>
              </div>
              <p className="text-left text-sm text-gray-600">
                {t("notificationSettings.description.groups")}
              </p>
            </div>
            <Switch
              aria-label={t("notificationSettings.groupNotifications")}
              checked={preferences.group_notifications_enabled ?? true}
              onCheckedChange={(checked) =>
                handleToggle("group_notifications_enabled", checked)
              }
              disabled={isUpdating}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* Push Notifications Section */}
        <div className="flex flex-col gap-4">
          <h4 className="text-lg font-semibold text-gray-700">
            {t("notificationSettings.pushNotifications")}
          </h4>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  <span className="font-medium">
                    {t("notificationSettings.pushNotifications")}
                  </span>
                </div>
                <p className="text-left text-sm text-gray-600">
                  {t("notificationSettings.description.push")}
                </p>
                {!pushSupported && (
                  <p className="text-sm text-amber-600">
                    {t("notificationSettings.status.notSupported")}
                  </p>
                )}
                {pushSupported && pushPermission === "denied" && (
                  <p className="text-sm text-red-600">
                    {t("notificationSettings.status.blocked")}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                {pushSupported && pushPermission === "default" && (
                  <Button
                    variant="yellowOutline"
                    size="sm"
                    onClick={handleRequestPushPermission}
                    disabled={isUpdating}
                  >
                    {t("notificationSettings.enablePush")}
                  </Button>
                )}

                {pushSupported && pushPermission === "granted" && (
                  <Switch
                    aria-label={t("notificationSettings.pushNotifications")}
                    checked={preferences.push_enabled ?? false}
                    onCheckedChange={(checked) =>
                      handleToggle("push_enabled", checked)
                    }
                    disabled={isUpdating}
                  />
                )}

                {pushSupported && pushPermission === "denied" && (
                  <div className="flex items-center text-gray-400">
                    <BellOff className="h-4 w-4" />
                  </div>
                )}

                {!pushSupported && (
                  <div className="flex items-center text-gray-400">
                    <BellOff className="h-4 w-4" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
