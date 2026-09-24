import { useFestival } from "@prostcounter/shared/contexts";
import { cn } from "@prostcounter/ui";
import { Eye, EyeOff, Info, Users } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, View } from "react-native";

import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { apiClient } from "@/lib/api-client";
import { Colors, SwitchColorsDestructive } from "@/lib/constants/colors";
import { logger } from "@/lib/logger";

interface GroupPhotoSetting {
  groupId: string;
  groupName: string;
  hidePhotosFromGroup: boolean;
}

interface PhotoPrivacySettings {
  hidePhotosFromAllGroups: boolean;
  groups: GroupPhotoSetting[];
}

export default function PhotoPrivacyScreen() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const festivalId = currentFestival?.id;
  const festivalName = currentFestival?.name ?? "";

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<PhotoPrivacySettings>({
    hidePhotosFromAllGroups: false,
    groups: [],
  });
  // Only the latest request may write state, so a slow response for the
  // previous festival can't overwrite the current one
  const latestRequestIdRef = useRef(0);

  const fetchSettings = useCallback(async () => {
    // The festival context finishes loading before it commits a selection, so
    // wait for an actual festival rather than listing every group
    if (!festivalId) {
      return;
    }
    const requestId = ++latestRequestIdRef.current;
    try {
      // Fetch global setting and group settings
      const [globalResponse, groupsResponse] = await Promise.all([
        apiClient.photos.getGlobalSettings().catch(() => ({ hidePhotosFromAllGroups: false })),
        apiClient.photos.getAllGroupSettings({ festivalId }).catch(() => ({ settings: [] })),
      ]);

      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      setSettings({
        hidePhotosFromAllGroups: globalResponse.hidePhotosFromAllGroups ?? false,
        groups: groupsResponse.settings ?? [],
      });
    } catch (error) {
      logger.error("Error fetching photo privacy settings:", error);
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [festivalId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const onRefresh = useCallback(() => {
    if (!festivalId) {
      return;
    }
    setIsRefreshing(true);
    fetchSettings();
  }, [fetchSettings, festivalId]);

  const handleGlobalToggle = async (value: boolean) => {
    const previousValue = settings.hidePhotosFromAllGroups;

    // Optimistic update
    setSettings((prev) => ({ ...prev, hidePhotosFromAllGroups: value }));
    setIsSaving(true);

    try {
      await apiClient.photos.updateGlobalSettings({
        hidePhotosFromAllGroups: value,
      });
    } catch {
      // Revert on error
      setSettings((prev) => ({
        ...prev,
        hidePhotosFromAllGroups: previousValue,
      }));
      Alert.alert(t("common.status.error"), t("profile.photoPrivacy.updateError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleGroupToggle = async (groupId: string, value: boolean) => {
    const groupIndex = settings.groups.findIndex((g) => g.groupId === groupId);
    if (groupIndex === -1) return;

    const previousValue = settings.groups[groupIndex].hidePhotosFromGroup;

    // Optimistic update
    setSettings((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.groupId === groupId ? { ...g, hidePhotosFromGroup: value } : g,
      ),
    }));
    setIsSaving(true);

    try {
      await apiClient.photos.updateGroupSettings(groupId, {
        hidePhotosFromGroup: value,
      });
    } catch {
      // Revert on error
      setSettings((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.groupId === groupId ? { ...g, hidePhotosFromGroup: previousValue } : g,
        ),
      }));
      Alert.alert(t("common.status.error"), t("profile.photoPrivacy.updateError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background-50"
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <View className="p-4">
        {/* Description */}
        <View className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
          <View className="flex-row items-start gap-3">
            <Info size={24} color={Colors.primary[600]} />
            <Text className="flex-1 text-sm text-yellow-800">
              {t("profile.photoPrivacy.description")}
            </Text>
          </View>
        </View>

        {/* Global Settings */}
        <View className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <Text className="mb-4 text-lg font-semibold text-typography-900">
            {t("profile.photoPrivacy.globalSettings")}
          </Text>

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-1 flex-row items-center gap-3">
              {settings.hidePhotosFromAllGroups ? (
                <EyeOff size={24} color={Colors.error[500]} />
              ) : (
                <Eye size={24} color={Colors.success[500]} />
              )}
              <View className="flex-1">
                <Text className="text-typography-900">{t("profile.photoPrivacy.hideFromAll")}</Text>
                <Text className="text-sm text-typography-500">
                  {t("profile.photoPrivacy.hideFromAllDescription")}
                </Text>
              </View>
            </View>
            <Switch
              value={settings.hidePhotosFromAllGroups}
              onValueChange={handleGlobalToggle}
              disabled={isSaving}
              trackColor={{
                false: SwitchColorsDestructive.trackOff,
                true: SwitchColorsDestructive.trackOn,
              }}
              thumbColor={SwitchColorsDestructive.thumb}
            />
          </View>
        </View>

        {/* Per-Group Settings */}
        <View className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <Text className="mb-2 text-lg font-semibold text-typography-900">
            {t("profile.photoPrivacy.perGroupSettings")}
          </Text>
          <Text className="mb-2 text-sm text-typography-500">
            {t("profile.photoPrivacy.perGroupDescription")}
          </Text>
          <Text className="mb-4 text-sm text-typography-500">
            {t("profile.photoPrivacy.festivalScope", { festival: festivalName })}
          </Text>

          {settings.groups.length === 0 ? (
            <View className="items-center py-4">
              <Users size={48} color={Colors.gray[300]} />
              <Text className="mt-2 text-center text-typography-500">
                {t("profile.photoPrivacy.noGroups", { festival: festivalName })}
              </Text>
            </View>
          ) : (
            settings.groups.map((group, index) => (
              <View
                key={group.groupId}
                className={cn(
                  "flex-row items-center justify-between py-3",
                  index < settings.groups.length - 1 && "border-b border-outline-100",
                )}
              >
                <View className="flex-1 flex-row items-center gap-3">
                  {group.hidePhotosFromGroup ? (
                    <EyeOff size={24} color={Colors.error[500]} />
                  ) : (
                    <Eye size={24} color={Colors.success[500]} />
                  )}
                  <View className="flex-1">
                    <Text className="text-typography-900">
                      {t("profile.photoPrivacy.hideFromGroup", {
                        group: group.groupName,
                      })}
                    </Text>
                    <Text className="text-sm text-typography-500">
                      {t("profile.photoPrivacy.hideFromGroupDescription")}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={group.hidePhotosFromGroup}
                  onValueChange={(value) => handleGroupToggle(group.groupId, value)}
                  disabled={isSaving || settings.hidePhotosFromAllGroups}
                  trackColor={{
                    false: SwitchColorsDestructive.trackOff,
                    true: SwitchColorsDestructive.trackOn,
                  }}
                  thumbColor={SwitchColorsDestructive.thumb}
                />
              </View>
            ))
          )}

          {/* Warning when global is enabled */}
          {settings.hidePhotosFromAllGroups && settings.groups.length > 0 && (
            <View className="mt-4 rounded-lg bg-red-50 p-3">
              <Text className="text-sm text-red-600">
                {t("profile.photoPrivacy.globalWarning")}
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
