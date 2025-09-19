"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useNotifications } from "@/contexts/NotificationContext";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function NotificationSettings() {
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
          Notification Settings
        </h3>
        <div className="flex justify-center py-4">
          <div className="text-gray-500">Loading...</div>
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
      toast.success("Settings Updated", {
        description: "Your notification preferences have been saved.",
      });
    } catch {
      toast.error("Error", {
        description:
          "Failed to update notification settings. Please try again.",
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
        toast.success("Push Notifications Enabled", {
          description:
            "You'll now receive push notifications when the app is closed.",
        });
      } else {
        toast.error("Permission Denied", {
          description:
            "Push notifications were blocked. You can enable them in your browser settings.",
        });
      }
    } catch (error: any) {
      toast.error("Error", {
        description: error.message || "Failed to enable push notifications.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="card">
      <h3 className="py-2 text-xl font-black text-gray-800">
        Notification Settings
      </h3>

      <div className="flex flex-col gap-6">
        {/* Consolidated Notification Preferences */}
        <div className="flex flex-col gap-4">
          <h4 className="text-lg font-semibold text-gray-700">Preferences</h4>

          {/* Reminders */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="font-medium">Reminders</span>
              </div>
              <p className="text-sm text-gray-600 text-left">
                Reservation reminders and check-in prompts
              </p>
            </div>
            <Switch
              aria-label="Reminders"
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
                <span className="font-medium">Achievement Notifications</span>
              </div>
              <p className="text-sm text-gray-600 text-left">
                Get notified when you unlock achievements
              </p>
            </div>
            <Switch
              aria-label="Achievement Notifications"
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
                <span className="font-medium">Group Notifications</span>
              </div>
              <p className="text-sm text-gray-600 text-left">
                Get notifications from your groups (check-ins, achievements,
                etc.)
              </p>
            </div>
            <Switch
              aria-label="Group Notifications"
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
            Push Notifications
          </h4>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  <span className="font-medium">Push Notifications</span>
                </div>
                <p className="text-sm text-gray-600 text-left">
                  Receive notifications even when the app is closed
                </p>
                {!pushSupported && (
                  <p className="text-sm text-amber-600">
                    Not supported in this browser
                  </p>
                )}
                {pushSupported && pushPermission === "denied" && (
                  <p className="text-sm text-red-600">
                    Blocked - Enable in browser settings
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 items-end">
                {pushSupported && pushPermission === "default" && (
                  <Button
                    variant="yellowOutline"
                    size="sm"
                    onClick={handleRequestPushPermission}
                    disabled={isUpdating}
                  >
                    Enable Push
                  </Button>
                )}

                {pushSupported && pushPermission === "granted" && (
                  <Switch
                    aria-label="Push Notifications"
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
