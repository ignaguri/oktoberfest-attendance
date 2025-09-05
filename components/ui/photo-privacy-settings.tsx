"use client";

import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  getAllUserGroupPhotoSettings,
  getUserGlobalPhotoSettings,
  updateGlobalPhotoSettings,
  updateGroupPhotoSettings,
} from "@/lib/actions/photo-visibility";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";

import type {
  GlobalPhotoSettingsFormData,
  GroupPhotoSettingsFormData,
} from "@/lib/schemas/photo-visibility";

interface GroupPhotoSetting {
  group_id: string;
  group_name: string;
  hide_photos_from_group: boolean;
}

export function PhotoPrivacySettings() {
  const [globalSettings, setGlobalSettings] =
    useState<GlobalPhotoSettingsFormData>({
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
        getUserGlobalPhotoSettings(),
        getAllUserGroupPhotoSettings(),
      ]);

      setGlobalSettings({
        hide_photos_from_all_groups: globalData.hide_photos_from_all_groups,
      });
      setGroupSettings(groupData);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load photo privacy settings",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGlobalToggle = async () => {
    setSavingGlobal(true);
    const newValue = !globalSettings.hide_photos_from_all_groups;

    try {
      await updateGlobalPhotoSettings({
        hide_photos_from_all_groups: newValue,
      });

      setGlobalSettings((prev) => ({
        ...prev,
        hide_photos_from_all_groups: newValue,
      }));

      toast({
        variant: "success",
        title: "Settings updated",
        description: newValue
          ? "Your photos are now hidden from all groups"
          : "Your photos are now visible to groups (subject to individual group settings)",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update global photo settings",
      });
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleGroupToggle = async (groupId: string, currentValue: boolean) => {
    setSavingGroups((prev) => new Set(prev).add(groupId));
    const newValue = !currentValue;

    try {
      const formData: GroupPhotoSettingsFormData = {
        group_id: groupId,
        hide_photos_from_group: newValue,
      };

      await updateGroupPhotoSettings(formData);

      setGroupSettings((prev) =>
        prev.map((group) =>
          group.group_id === groupId
            ? { ...group, hide_photos_from_group: newValue }
            : group,
        ),
      );

      const groupName =
        groupSettings.find((g) => g.group_id === groupId)?.group_name ||
        "group";
      toast({
        variant: "success",
        title: "Group settings updated",
        description: newValue
          ? `Your photos are now hidden from ${groupName}`
          : `Your photos are now visible to ${groupName}`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update group photo settings",
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
          Photo Privacy Settings
        </h3>
        <div className="flex justify-center py-4">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="py-2 text-xl font-black text-gray-800">
        Photo Privacy Settings
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Control who can see your photos in group galleries. Individual photos
        can also be set as private.
      </p>

      <div className="flex flex-col gap-6">
        {/* Global Setting */}
        <div className="flex flex-col gap-4">
          <h4 className="text-lg font-semibold text-gray-700">
            Global Settings
          </h4>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {globalSettings.hide_photos_from_all_groups ? (
                  <EyeOff className="h-4 w-4 text-red-600" />
                ) : (
                  <Eye className="h-4 w-4 text-green-600" />
                )}
                <span className="font-medium">Hide photos from all groups</span>
              </div>
              <p className="text-sm text-gray-600 text-left">
                When enabled, your photos won&apos;t appear in any group gallery
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
                Per-Group Settings
              </h4>
              <p className="text-sm text-gray-600">
                Choose which groups can see your photos. These settings only
                apply when global hiding is disabled.
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
                          Hide photos from {group.group_name}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 text-left">
                        When enabled, your photos won&apos;t appear in this
                        group&apos;s gallery
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
                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                  ⚠️ Global photo hiding is enabled. Per-group settings are
                  currently disabled.
                </div>
              )}
            </div>
          </>
        )}

        {groupSettings.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            You&apos;re not a member of any groups yet. Join a group to see
            per-group photo visibility settings.
          </div>
        )}
      </div>
    </div>
  );
}
