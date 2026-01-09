import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Info, Users } from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { Text } from '@/components/ui/text';
import { Switch } from '@/components/ui/switch';
import { Colors, IconColors, SwitchColorsDestructive } from '@/lib/constants/colors';
import { apiClient } from '@/lib/api-client';

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

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<PhotoPrivacySettings>({
    hidePhotosFromAllGroups: false,
    groups: [],
  });

  const fetchSettings = useCallback(async () => {
    try {
      // Fetch global setting and group settings
      const [globalResponse, groupsResponse] = await Promise.all([
        apiClient.photos.getGlobalSettings().catch(() => ({ hidePhotosFromAllGroups: false })),
        apiClient.photos.getAllGroupSettings().catch(() => ({ settings: [] })),
      ]);

      setSettings({
        hidePhotosFromAllGroups: globalResponse.hidePhotosFromAllGroups ?? false,
        groups: groupsResponse.settings ?? [],
      });
    } catch (error) {
      console.error('Error fetching photo privacy settings:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchSettings();
  }, [fetchSettings]);

  const handleGlobalToggle = async (value: boolean) => {
    const previousValue = settings.hidePhotosFromAllGroups;

    // Optimistic update
    setSettings((prev) => ({ ...prev, hidePhotosFromAllGroups: value }));
    setIsSaving(true);

    try {
      await apiClient.photos.updateGlobalSettings({ hidePhotosFromAllGroups: value });
    } catch (error) {
      // Revert on error
      setSettings((prev) => ({ ...prev, hidePhotosFromAllGroups: previousValue }));
      Alert.alert(
        t('common.status.error'),
        t('profile.photoPrivacy.updateError', {
          defaultValue: 'Failed to update photo privacy settings',
        })
      );
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
        g.groupId === groupId ? { ...g, hidePhotosFromGroup: value } : g
      ),
    }));
    setIsSaving(true);

    try {
      await apiClient.photos.updateGroupSettings(groupId, { hidePhotosFromGroup: value });
    } catch (error) {
      // Revert on error
      setSettings((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.groupId === groupId ? { ...g, hidePhotosFromGroup: previousValue } : g
        ),
      }));
      Alert.alert(
        t('common.status.error'),
        t('profile.photoPrivacy.updateError', {
          defaultValue: 'Failed to update photo privacy settings',
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background-50 items-center justify-center">
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background-50"
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <View className="p-4">
        {/* Description */}
        <View className="bg-yellow-50 rounded-2xl p-4 mb-4 border border-yellow-200">
          <View className="flex-row items-start gap-3">
            <Info size={24} color={Colors.primary[600]} />
            <Text className="text-yellow-800 text-sm flex-1">
              {t('profile.photoPrivacy.description', {
                defaultValue:
                  'Control who can see your photos in group galleries. Individual photos can also be set as private.',
              })}
            </Text>
          </View>
        </View>

        {/* Global Settings */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-semibold text-typography-900 mb-4">
            {t('profile.photoPrivacy.globalSettings', { defaultValue: 'Global Settings' })}
          </Text>

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center gap-3 flex-1">
              {settings.hidePhotosFromAllGroups ? (
                <EyeOff size={24} color={Colors.error[500]} />
              ) : (
                <Eye size={24} color={Colors.success[500]} />
              )}
              <View className="flex-1">
                <Text className="text-typography-900">
                  {t('profile.photoPrivacy.hideFromAll', {
                    defaultValue: 'Hide photos from all groups',
                  })}
                </Text>
                <Text className="text-typography-500 text-sm">
                  {t('profile.photoPrivacy.hideFromAllDescription', {
                    defaultValue: "When enabled, your photos won't appear in any group gallery",
                  })}
                </Text>
              </View>
            </View>
            <Switch
              value={settings.hidePhotosFromAllGroups}
              onValueChange={handleGlobalToggle}
              disabled={isSaving}
              trackColor={{ false: SwitchColorsDestructive.trackOff, true: SwitchColorsDestructive.trackOn }}
              thumbColor={SwitchColorsDestructive.thumb}
            />
          </View>
        </View>

        {/* Per-Group Settings */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-semibold text-typography-900 mb-2">
            {t('profile.photoPrivacy.perGroupSettings', { defaultValue: 'Per-Group Settings' })}
          </Text>
          <Text className="text-typography-500 text-sm mb-4">
            {t('profile.photoPrivacy.perGroupDescription', {
              defaultValue:
                'Choose which groups can see your photos. These settings only apply when global hiding is disabled.',
            })}
          </Text>

          {settings.groups.length === 0 ? (
            <View className="py-4 items-center">
              <Users size={48} color={Colors.gray[300]} />
              <Text className="text-typography-500 text-center mt-2">
                {t('profile.photoPrivacy.noGroups', {
                  defaultValue: "You're not a member of any groups yet.",
                })}
              </Text>
            </View>
          ) : (
            settings.groups.map((group, index) => (
              <View
                key={group.groupId}
                className={`flex-row items-center justify-between py-3 ${
                  index < settings.groups.length - 1 ? 'border-b border-outline-100' : ''
                }`}
              >
                <View className="flex-row items-center gap-3 flex-1">
                  {group.hidePhotosFromGroup ? (
                    <EyeOff size={24} color={Colors.error[500]} />
                  ) : (
                    <Eye size={24} color={Colors.success[500]} />
                  )}
                  <View className="flex-1">
                    <Text className="text-typography-900">
                      {t('profile.photoPrivacy.hideFromGroup', {
                        defaultValue: 'Hide photos from {{group}}',
                        group: group.groupName,
                      })}
                    </Text>
                    <Text className="text-typography-500 text-sm">
                      {t('profile.photoPrivacy.hideFromGroupDescription', {
                        defaultValue: "When enabled, your photos won't appear in this group's gallery",
                      })}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={group.hidePhotosFromGroup}
                  onValueChange={(value) => handleGroupToggle(group.groupId, value)}
                  disabled={isSaving || settings.hidePhotosFromAllGroups}
                  trackColor={{ false: SwitchColorsDestructive.trackOff, true: SwitchColorsDestructive.trackOn }}
                  thumbColor={SwitchColorsDestructive.thumb}
                />
              </View>
            ))
          )}

          {/* Warning when global is enabled */}
          {settings.hidePhotosFromAllGroups && settings.groups.length > 0 && (
            <View className="bg-red-50 rounded-lg p-3 mt-4">
              <Text className="text-red-600 text-sm">
                {t('profile.photoPrivacy.globalWarning', {
                  defaultValue:
                    'Per-group settings are disabled because global hiding is enabled.',
                })}
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
