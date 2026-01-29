/**
 * GroupSelectorSheet Component
 *
 * Bottom sheet for selecting which groups to share location with.
 */

import { useUserGroups } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Check, Users } from "lucide-react-native";
import { useCallback, useEffect } from "react";
import { ScrollView, View } from "react-native";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "@/components/ui/actionsheet";
import { Button, ButtonText } from "@/components/ui/button";
import {
  Checkbox,
  CheckboxIcon,
  CheckboxIndicator,
  CheckboxLabel,
} from "@/components/ui/checkbox";
import { Heading } from "@/components/ui/heading";
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

interface GroupSelectorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  festivalId: string;
  selectedGroupIds: string[];
  onSelectionChange: (groupIds: string[]) => void;
  shareWithAll: boolean;
  onShareWithAllChange: (shareWithAll: boolean) => void;
}

export function GroupSelectorSheet({
  isOpen,
  onClose,
  festivalId,
  selectedGroupIds,
  onSelectionChange,
  shareWithAll,
  onShareWithAllChange,
}: GroupSelectorSheetProps) {
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

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="bg-background-0 pb-8">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="md" className="w-full px-4 py-4">
          {/* Header */}
          <HStack className="items-center justify-between">
            <Heading size="md" className="text-typography-900">
              {t("location.groups.title")}
            </Heading>
          </HStack>

          {loading ? (
            <VStack className="items-center py-8">
              <Spinner size="large" color={Colors.primary[500]} />
            </VStack>
          ) : groups.length === 0 ? (
            <VStack space="sm" className="items-center py-8">
              <Users size={40} color={IconColors.muted} />
              <Text className="text-center text-typography-500">
                {t("location.groups.noGroups")}
              </Text>
              <Text className="text-center text-sm text-typography-400">
                {t("location.groups.noGroupsHint")}
              </Text>
            </VStack>
          ) : (
            <>
              {/* Share with all toggle */}
              <Pressable
                onPress={() => handleShareWithAllToggle(!shareWithAll)}
                className="active:opacity-80"
              >
                <HStack className="items-center justify-between rounded-lg bg-background-50 p-4">
                  <VStack className="flex-1">
                    <Text className="font-medium text-typography-900">
                      {t("location.groups.shareWithAll")}
                    </Text>
                    <Text className="text-sm text-typography-500">
                      {t("location.groups.shareWithAllDescription")}
                    </Text>
                  </VStack>
                  <Switch
                    value={shareWithAll}
                    onValueChange={handleShareWithAllToggle}
                    trackColor={{
                      false: SwitchColors.trackOff,
                      true: SwitchColors.trackOn,
                    }}
                  />
                </HStack>
              </Pressable>

              {/* Group list */}
              <VStack space="xs">
                <Text className="text-xs font-medium uppercase tracking-wide text-typography-500">
                  {t("location.groups.selectGroups")}
                </Text>
                <ScrollView
                  style={{ maxHeight: 250 }}
                  showsVerticalScrollIndicator={false}
                >
                  <VStack space="sm">
                    {groups.map((group: Group) => {
                      const isSelected = selectedGroupIds.includes(group.id);
                      return (
                        <HStack
                          key={group.id}
                          space="md"
                          className={`items-center rounded-lg border p-3 ${
                            isSelected && !shareWithAll
                              ? "border-primary-500 bg-primary-50"
                              : "border-outline-200 bg-background-0"
                          } ${shareWithAll ? "opacity-50" : ""}`}
                        >
                          <Checkbox
                            value={group.id}
                            isChecked={isSelected}
                            isDisabled={shareWithAll}
                            onChange={() => handleToggleGroup(group.id)}
                            size="md"
                            className="flex-1"
                          >
                            <CheckboxIndicator>
                              <CheckboxIcon as={Check} />
                            </CheckboxIndicator>
                            <CheckboxLabel
                              className={`flex-1 font-medium ${
                                isSelected && !shareWithAll
                                  ? "text-primary-700"
                                  : "text-typography-900"
                              }`}
                            >
                              {group.name}
                            </CheckboxLabel>
                          </Checkbox>
                          <Text className="text-xs text-typography-500">
                            {group.memberCount || 0} {t("common.members")}
                          </Text>
                        </HStack>
                      );
                    })}
                  </VStack>
                </ScrollView>
              </VStack>

              {/* Selection summary */}
              <View className="border-t border-outline-200 pt-4">
                <Text className="text-center text-sm text-typography-600">
                  {shareWithAll
                    ? t("location.groups.sharingWithAll")
                    : t("location.groups.sharingWithSome", {
                        count: selectedGroupIds.length,
                      })}
                </Text>
              </View>

              {/* Done button */}
              <Button onPress={onClose} action="primary" className="mt-2">
                <ButtonText>{t("common.buttons.done")}</ButtonText>
              </Button>
            </>
          )}
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
