import { useTranslation } from "@prostcounter/shared/i18n";
import type { GetCompanionOptionsResponse } from "@prostcounter/shared/schemas";
import { getInitials } from "@prostcounter/ui";
import { Check, Users, X } from "lucide-react-native";
import { useCallback } from "react";
import { ActivityIndicator } from "react-native";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
  ActionsheetSectionHeaderText,
} from "@/components/ui/actionsheet";
import { Avatar, AvatarFallbackText, AvatarImage } from "@/components/ui/avatar";
import { Button, ButtonText } from "@/components/ui/button";
import { Checkbox, CheckboxIcon, CheckboxIndicator, CheckboxLabel } from "@/components/ui/checkbox";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";

interface CompanionPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  options: GetCompanionOptionsResponse | null;
  isLoading: boolean;
  hasError: boolean;
  selectedUserIds: string[];
  selectedGroupIds: string[];
  onChange: (selection: { userIds: string[]; groupIds: string[] }) => void;
}

function toggle(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

/**
 * Pick who a plan is going with: the user's groups in the festival, then
 * friends and group-mates. Toggles apply as they're tapped; Done just closes.
 */
export function CompanionPickerSheet({
  isOpen,
  onClose,
  options,
  isLoading,
  hasError,
  selectedUserIds,
  selectedGroupIds,
  onChange,
}: CompanionPickerSheetProps) {
  const { t } = useTranslation();
  const selectedCount = selectedUserIds.length + selectedGroupIds.length;
  const hasOptions = !!options && (options.users.length > 0 || options.groups.length > 0);

  const handleToggleGroup = useCallback(
    (groupId: string) => {
      onChange({ userIds: selectedUserIds, groupIds: toggle(selectedGroupIds, groupId) });
    },
    [onChange, selectedUserIds, selectedGroupIds],
  );

  const handleToggleUser = useCallback(
    (userId: string) => {
      onChange({ userIds: toggle(selectedUserIds, userId), groupIds: selectedGroupIds });
    },
    [onChange, selectedUserIds, selectedGroupIds],
  );

  const handleClear = useCallback(() => {
    onChange({ userIds: [], groupIds: [] });
  }, [onChange]);

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[80%] pb-8">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <HStack className="mb-3 w-full items-center justify-between px-2">
          <Text className="text-lg font-semibold text-typography-900">
            {t("attendance.planner.companionPicker.title")}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.buttons.close")}
          >
            <X size={24} color={IconColors.default} />
          </Pressable>
        </HStack>

        {isLoading && !options && (
          <VStack className="items-center justify-center py-8">
            <ActivityIndicator size="large" color={IconColors.default} />
          </VStack>
        )}

        {hasError && !options && (
          <VStack className="items-center justify-center py-8">
            <Text className="text-center text-error-600">
              {t("attendance.planner.companionPicker.error")}
            </Text>
          </VStack>
        )}

        {options && !hasOptions && (
          <VStack space="md" className="items-center justify-center px-4 py-8">
            <Users size={32} color={IconColors.muted} />
            <Text className="text-center text-typography-500">
              {t("attendance.planner.companionPicker.empty")}
            </Text>
          </VStack>
        )}

        {options && hasOptions && (
          <ActionsheetScrollView className="max-h-[360px] w-full">
            {options.groups.length > 0 && (
              <>
                <ActionsheetSectionHeaderText className="bg-background-50">
                  {t("attendance.planner.companionPicker.groups")}
                </ActionsheetSectionHeaderText>
                {options.groups.map((group) => (
                  <Checkbox
                    key={group.groupId}
                    value={group.groupId}
                    isChecked={selectedGroupIds.includes(group.groupId)}
                    onChange={() => handleToggleGroup(group.groupId)}
                    size="md"
                    className="px-4 py-3"
                  >
                    <CheckboxIndicator>
                      <CheckboxIcon as={Check} color={IconColors.white} />
                    </CheckboxIndicator>
                    <HStack space="sm" className="flex-1 items-center">
                      <Users size={18} color={IconColors.muted} />
                      <CheckboxLabel className="flex-1" numberOfLines={1}>
                        {group.name}
                      </CheckboxLabel>
                    </HStack>
                  </Checkbox>
                ))}
              </>
            )}

            {options.users.length > 0 && (
              <>
                <ActionsheetSectionHeaderText className="bg-background-50">
                  {t("attendance.planner.companionPicker.people")}
                </ActionsheetSectionHeaderText>
                {options.users.map((user) => {
                  const displayName =
                    user.username || user.fullName || t("attendance.planner.unknownFriend");

                  return (
                    <Checkbox
                      key={user.userId}
                      value={user.userId}
                      isChecked={selectedUserIds.includes(user.userId)}
                      onChange={() => handleToggleUser(user.userId)}
                      size="md"
                      className="px-4 py-3"
                    >
                      <CheckboxIndicator>
                        <CheckboxIcon as={Check} color={IconColors.white} />
                      </CheckboxIndicator>
                      <HStack space="sm" className="flex-1 items-center">
                        <Avatar size="xs">
                          {user.avatarUrl ? (
                            <AvatarImage
                              source={{ uri: getAvatarUrl(user.avatarUrl) }}
                              alt={displayName}
                            />
                          ) : (
                            <AvatarFallbackText>
                              {getInitials({ fullName: user.fullName, username: user.username })}
                            </AvatarFallbackText>
                          )}
                        </Avatar>
                        <CheckboxLabel className="flex-1" numberOfLines={1}>
                          {displayName}
                        </CheckboxLabel>
                      </HStack>
                    </Checkbox>
                  );
                })}
              </>
            )}
          </ActionsheetScrollView>
        )}

        <HStack className="w-full gap-3 px-2 pt-3">
          <Button
            variant="outline"
            action="secondary"
            className="flex-1"
            onPress={handleClear}
            isDisabled={selectedCount === 0}
          >
            <ButtonText>{t("attendance.planner.companionPicker.clear")}</ButtonText>
          </Button>
          <Button variant="solid" action="primary" className="flex-1" onPress={onClose}>
            <ButtonText>
              {selectedCount > 0
                ? t("attendance.planner.companionPicker.doneCount", { count: selectedCount })
                : t("common.buttons.done")}
            </ButtonText>
          </Button>
        </HStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}

CompanionPickerSheet.displayName = "CompanionPickerSheet";
