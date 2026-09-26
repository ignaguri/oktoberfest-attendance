import { usePlanCompanionOptions } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { getInitials } from "@prostcounter/ui";
import { UserPlus } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";

import { CompanionPickerSheet } from "@/components/attendance/day-planner/companion-picker-sheet";
import { Avatar, AvatarFallbackText, AvatarImage } from "@/components/ui/avatar";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";

interface PhotoTagRowProps {
  festivalId: string;
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
  disabled?: boolean;
}

/**
 * "Who's in these?" under photos picked for upload. Opens the companion
 * picker in photo mode; the selection applies to the whole batch.
 */
export function PhotoTagRow({
  festivalId,
  selectedUserIds,
  onChange,
  disabled = false,
}: PhotoTagRowProps) {
  const { t } = useTranslation();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const {
    data: options,
    loading,
    error,
  } = usePlanCompanionOptions(festivalId, {
    enabled: isPickerOpen || selectedUserIds.length > 0,
  });

  const selectedUsers = useMemo(
    () => (options?.users ?? []).filter((user) => selectedUserIds.includes(user.userId)),
    [options?.users, selectedUserIds],
  );

  const handlePickerChange = useCallback(
    (selection: { userIds: string[]; groupIds: string[] }) => {
      onChange(selection.userIds);
    },
    [onChange],
  );

  return (
    <>
      <Pressable
        onPress={() => setIsPickerOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t("photoTags.tagPeople")}
        accessibilityHint={t("photoTags.editHint")}
        className="rounded-lg border border-outline-200 bg-background-50 px-3 py-2 active:opacity-70"
      >
        <HStack space="sm" className="items-center">
          <UserPlus size={18} color={IconColors.muted} />
          {selectedUsers.length === 0 ? (
            <Text className="text-sm text-typography-500">{t("photoTags.whosInThese")}</Text>
          ) : (
            <HStack space="xs" className="flex-1 items-center">
              {selectedUsers.map((user) => (
                <Avatar key={user.userId} size="xs">
                  {user.avatarUrl ? (
                    <AvatarImage
                      source={{ uri: getAvatarUrl(user.avatarUrl) }}
                      alt={user.username || user.fullName || ""}
                    />
                  ) : (
                    <AvatarFallbackText>
                      {getInitials({ fullName: user.fullName, username: user.username })}
                    </AvatarFallbackText>
                  )}
                </Avatar>
              ))}
            </HStack>
          )}
        </HStack>
      </Pressable>

      <CompanionPickerSheet
        mode="photo"
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        options={options ?? null}
        isLoading={loading}
        hasError={!!error}
        selectedUserIds={selectedUserIds}
        selectedGroupIds={[]}
        onChange={handlePickerChange}
      />
    </>
  );
}
