/**
 * GroupSelector Component
 *
 * Compact group selection for location sharing visibility.
 * Designed to fit inside an accordion panel.
 */

import { useUserGroups } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import { Check, Users } from "lucide-react-native";
import { useCallback, useEffect } from "react";
import { ScrollView } from "react-native";

import {
  Checkbox,
  CheckboxIcon,
  CheckboxIndicator,
  CheckboxLabel,
} from "@/components/ui/checkbox";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors, SwitchColors } from "@/lib/constants/colors";

interface Group {
  id: string;
  name: string;
  description?: string | null;
  memberCount?: number;
}

interface GroupSelectorProps {
  festivalId: string;
  selectedGroupIds: string[];
  onSelectionChange: (groupIds: string[]) => void;
  shareWithAll: boolean;
  onShareWithAllChange: (shareWithAll: boolean) => void;
}

export function GroupSelector({
  festivalId,
  selectedGroupIds,
  onSelectionChange,
  shareWithAll,
  onShareWithAllChange,
}: GroupSelectorProps) {
  const { t } = useTranslation();
  const { data, loading } = useUserGroups(festivalId);
  const groups = (data as Group[] | null) || [];

  // When shareWithAll is toggled on, select all groups
  useEffect(() => {
    if (shareWithAll && groups.length > 0) {
      const allIds = groups.map((g: Group) => g.id);
      if (
        allIds.length > 0 &&
        (selectedGroupIds.length !== allIds.length ||
          !allIds.every((id: string) => selectedGroupIds.includes(id)))
      ) {
        onSelectionChange(allIds);
      }
    }
  }, [shareWithAll, groups, selectedGroupIds, onSelectionChange]);

  const handleToggleGroup = useCallback(
    (groupId: string) => {
      if (shareWithAll) {
        // When turning off shareWithAll, keep only this group
        onShareWithAllChange(false);
        onSelectionChange([groupId]);
      } else {
        // Toggle individual group
        if (selectedGroupIds.includes(groupId)) {
          const newSelection = selectedGroupIds.filter((id) => id !== groupId);
          // If no groups selected, turn on shareWithAll
          if (newSelection.length === 0) {
            onShareWithAllChange(true);
          } else {
            onSelectionChange(newSelection);
          }
        } else {
          onSelectionChange([...selectedGroupIds, groupId]);
        }
      }
    },
    [shareWithAll, selectedGroupIds, onSelectionChange, onShareWithAllChange],
  );

  const handleShareWithAllToggle = useCallback(
    (value: boolean) => {
      onShareWithAllChange(value);
      if (value && groups.length > 0) {
        onSelectionChange(groups.map((g: Group) => g.id));
      }
    },
    [groups, onSelectionChange, onShareWithAllChange],
  );

  if (loading) {
    return (
      <HStack className="items-center justify-center py-4">
        <Spinner size="small" color={Colors.primary[500]} />
        <Text className="ml-2 text-sm text-typography-500">
          {t("common.loading")}
        </Text>
      </HStack>
    );
  }

  if (groups.length === 0) {
    return (
      <HStack space="sm" className="items-center py-3">
        <Users size={16} color={IconColors.muted} />
        <Text className="text-sm text-typography-500">
          {t("location.groups.noGroups")}
        </Text>
      </HStack>
    );
  }

  return (
    <VStack space="sm" className="pt-3">
      {/* Share with all toggle */}
      <Pressable
        onPress={() => handleShareWithAllToggle(!shareWithAll)}
        className="active:opacity-80"
      >
        <HStack className="items-center justify-between rounded-lg bg-background-0 p-2">
          <Text className="text-sm text-typography-700">
            {t("location.groups.shareWithAll")}
          </Text>
          <Switch
            size="sm"
            value={shareWithAll}
            onValueChange={handleShareWithAllToggle}
            trackColor={{
              false: SwitchColors.trackOff,
              true: SwitchColors.trackOn,
            }}
          />
        </HStack>
      </Pressable>

      {/* Divider with text */}
      <HStack className="items-center py-1">
        <Text className="flex-1 text-center text-xs text-typography-400">
          {t("location.groups.orSelectSpecific")}
        </Text>
      </HStack>

      {/* Group list */}
      <ScrollView
        style={{ maxHeight: 150 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <VStack space="xs">
          {groups.map((group: Group) => {
            const isSelected = selectedGroupIds.includes(group.id);
            return (
              <HStack
                key={group.id}
                space="sm"
                className={cn(
                  "items-center rounded-lg bg-background-0 p-2",
                  shareWithAll && "opacity-50",
                )}
              >
                <Checkbox
                  value={group.id}
                  isChecked={isSelected}
                  isDisabled={shareWithAll}
                  onChange={() => handleToggleGroup(group.id)}
                  size="sm"
                  className="flex-1"
                >
                  <CheckboxIndicator>
                    <CheckboxIcon as={Check} />
                  </CheckboxIndicator>
                  <CheckboxLabel
                    className={cn(
                      "flex-1 text-sm",
                      isSelected && !shareWithAll
                        ? "font-medium text-primary-700"
                        : "text-typography-700",
                    )}
                  >
                    {group.name}
                  </CheckboxLabel>
                </Checkbox>
                <Text className="text-xs text-typography-400">
                  {group.memberCount || 0}
                </Text>
              </HStack>
            );
          })}
        </VStack>
      </ScrollView>
    </VStack>
  );
}
