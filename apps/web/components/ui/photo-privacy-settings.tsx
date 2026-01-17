"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n/client";

interface GroupPhotoSetting {
  group_id: string;
  group_name: string;
  hide_photos_from_group: boolean;
}

export function PhotoPrivacySettings() {
  const { t } = useTranslation();
  const [globalSettings, setGlobalSettings] = useState<{
    hide_photos_from_all_groups: boolean;
  }>({
    hide_photos_from_all_groups: false,
  });
  const [groupSettings, setGroupSettings] = useState<GroupPhotoSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingGroups, setSavingGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [globalData, groupData] = await Promise.all([
        apiClient.photos.getGlobalSettings(),
        apiClient.photos.getAllGroupSettings(),
      ]);

      setGlobalSettings({
        hide_photos_from_all_groups: globalData.hidePhotosFromAllGroups,
      });

      // Map API response to component format
      setGroupSettings(
        groupData.settings.map((s) => ({
          group_id: s.groupId,
          group_name: s.groupName,
          hide_photos_from_group: s.hidePhotosFromGroup,
        })),
      );
    } catch {
      toast.error(t("common.status.error"), {
        description: t("photo.privacy.loadError"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGlobalToggle = async () => {
    setSavingGlobal(true);
    const newValue = !globalSettings.hide_photos_from_all_groups;

    try {
      await apiClient.photos.updateGlobalSettings({
        hidePhotosFromAllGroups: newValue,
      });

      setGlobalSettings((prev) => ({
        ...prev,
        hide_photos_from_all_groups: newValue,
      }));

      toast.success(t("notifications.success.settingsUpdated"), {
        description: newValue
          ? t("photo.privacy.hiddenFromAll")
          : t("photo.privacy.visibleToGroups"),
      });
    } catch {
      toast.error(t("common.status.error"), {
        description: t("photo.privacy.updateError"),
      });
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleGroupToggle = async (groupId: string, currentValue: boolean) => {
    setSavingGroups((prev) => new Set(prev).add(groupId));
    const newValue = !currentValue;

    try {
      await apiClient.photos.updateGroupSettings(groupId, {
        hidePhotosFromGroup: newValue,
      });

      setGroupSettings((prev) =>
        prev.map((group) =>
          group.group_id === groupId
            ? { ...group, hide_photos_from_group: newValue }
            : group,
        ),
      );

      const groupName =
        groupSettings.find((g) => g.group_id === groupId)?.group_name ||
        t("photo.privacy.defaultGroupName");
      toast.success(t("photo.privacy.groupSettingsUpdated"), {
        description: newValue
          ? t("photo.privacy.hiddenFromGroup", { group: groupName })
          : t("photo.privacy.visibleToGroup", { group: groupName }),
      });
    } catch {
      toast.error(t("common.status.error"), {
        description: t("photo.privacy.updateGroupError"),
      });
    } finally {
      setSavingGroups((prev) => {
        const newSet = new Set(prev);
        newSet.delete(groupId);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <h3 className="py-2 text-2xl font-black text-gray-800">
          {t("photo.privacy.title")}
        </h3>
        <div className="flex justify-center py-4">
          <div className="text-gray-500">{t("common.status.loading")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="py-2 text-xl font-black text-gray-800">
        {t("photo.privacy.title")}
      </h3>
      <p className="mb-6 text-sm text-gray-600">
        {t("photo.privacy.description")}
      </p>

      <div className="flex flex-col gap-6">
        {/* Global Setting */}
        <div className="flex flex-col gap-4">
          <h4 className="text-lg font-semibold text-gray-700">
            {t("photo.privacy.globalSettings")}
          </h4>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {globalSettings.hide_photos_from_all_groups ? (
                  <EyeOff className="h-4 w-4 text-red-600" />
                ) : (
                  <Eye className="h-4 w-4 text-green-600" />
                )}
                <span className="font-medium">
                  {t("photo.privacy.hideFromAll")}
                </span>
              </div>
              <p className="text-left text-sm text-gray-600">
                {t("photo.privacy.hideFromAllDescription")}
              </p>
            </div>
            <Switch
              checked={globalSettings.hide_photos_from_all_groups}
              onCheckedChange={handleGlobalToggle}
              disabled={savingGlobal}
            />
          </div>
        </div>

        {/* Group-specific Settings */}
        {groupSettings.length > 0 && (
          <>
            <div className="border-t border-gray-200" />
            <div className="flex flex-col gap-4">
              <h4 className="text-lg font-semibold text-gray-700">
                {t("photo.privacy.perGroupSettings")}
              </h4>
              <p className="text-sm text-gray-600">
                {t("photo.privacy.perGroupDescription")}
              </p>

              <div className="space-y-4">
                {groupSettings.map((group) => (
                  <div
                    key={group.group_id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {group.hide_photos_from_group ? (
                          <EyeOff className="h-4 w-4 text-red-600" />
                        ) : (
                          <Eye className="h-4 w-4 text-green-600" />
                        )}
                        <span className="font-medium">
                          {t("photo.privacy.hideFromGroup", {
                            group: group.group_name,
                          })}
                        </span>
                      </div>
                      <p className="text-left text-sm text-gray-600">
                        {t("photo.privacy.hideFromGroupDescription")}
                      </p>
                    </div>
                    <Switch
                      checked={group.hide_photos_from_group}
                      onCheckedChange={() =>
                        handleGroupToggle(
                          group.group_id,
                          group.hide_photos_from_group,
                        )
                      }
                      disabled={
                        savingGroups.has(group.group_id) ||
                        globalSettings.hide_photos_from_all_groups
                      }
                    />
                  </div>
                ))}
              </div>

              {globalSettings.hide_photos_from_all_groups && (
                <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-600">
                  {t("photo.privacy.globalHidingWarning")}
                </div>
              )}
            </div>
          </>
        )}

        {groupSettings.length === 0 && (
          <div className="py-4 text-center text-gray-500">
            {t("photo.privacy.noGroupsYet")}
          </div>
        )}
      </div>
    </div>
  );
}
