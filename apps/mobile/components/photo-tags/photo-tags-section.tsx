import { usePhotoTags, usePlanCompanionOptions, useSetPhotoTags } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { UserPlus } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";

import { CompanionPickerSheet } from "@/components/attendance/day-planner/companion-picker-sheet";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

interface PhotoTagsSectionProps {
  photoId: string;
  groupId?: string;
  onUserPress: (userId: string) => void;
}

/**
 * Whose photo it is and who is in it, under the photo in the viewer. The
 * uploader of a public photo can change the tags; the picker saves when it closes.
 */
export function PhotoTagsSection({ photoId, groupId, onUserPress }: PhotoTagsSectionProps) {
  const { t } = useTranslation();
  const { data: tags } = usePhotoTags(photoId);
  const setPhotoTags = useSetPhotoTags();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draftUserIds, setDraftUserIds] = useState<string[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);

  const canEdit = !!tags?.canEdit && !!tags.festivalId;
  const {
    data: options,
    loading,
    error,
  } = usePlanCompanionOptions(tags?.festivalId ?? undefined, { enabled: isPickerOpen });

  const taggedUsers = useMemo(() => tags?.taggedUsers ?? [], [tags?.taggedUsers]);

  const openPicker = useCallback(() => {
    setDraftUserIds(taggedUsers.map((user) => user.userId));
    setSaveFailed(false);
    setIsPickerOpen(true);
  }, [taggedUsers]);

  const closePicker = useCallback(async () => {
    setIsPickerOpen(false);
    const current = taggedUsers.map((user) => user.userId);
    const changed =
      current.length !== draftUserIds.length || current.some((id) => !draftUserIds.includes(id));
    if (!changed) {
      return;
    }
    try {
      await setPhotoTags.mutateAsync({ photoId, userIds: draftUserIds, groupId });
    } catch {
      setSaveFailed(true);
    }
  }, [taggedUsers, draftUserIds, setPhotoTags, photoId, groupId]);

  if (!tags) {
    return null;
  }

  const uploaderName = tags.uploader.username || tags.uploader.fullName || "";
  const showTags = taggedUsers.length > 0 || canEdit;

  return (
    <View className="border-b border-outline-200 px-4 py-2">
      <VStack space="xs">
        <Pressable
          onPress={() => onUserPress(tags.uploader.userId)}
          accessibilityRole="button"
          accessibilityLabel={t("photoTags.photoBy", { name: uploaderName })}
          accessibilityHint={t("photoTags.openProfileHint")}
          className="self-start py-1 active:opacity-70"
        >
          <Text className="text-sm text-typography-500">
            {t("photoTags.photoByPrefix")}{" "}
            <Text className="text-sm font-semibold text-typography-900">{uploaderName}</Text>
          </Text>
        </Pressable>
        {showTags && (
          <HStack space="sm" className="flex-wrap items-center">
            <Text className="text-sm text-typography-500">{t("photoTags.inThisPhoto")}</Text>
            {taggedUsers.map((user) => {
              const name = user.username || user.fullName || "";
              return (
                <Pressable
                  key={user.userId}
                  onPress={() => onUserPress(user.userId)}
                  accessibilityRole="button"
                  accessibilityLabel={name}
                  accessibilityHint={t("photoTags.openProfileHint")}
                  className="rounded-full bg-background-100 px-3 py-1 active:opacity-70"
                >
                  <Text className="text-sm text-typography-700">{name}</Text>
                </Pressable>
              );
            })}
            {canEdit && (
              <Pressable
                onPress={openPicker}
                accessibilityRole="button"
                accessibilityLabel={t("photoTags.tagPeople")}
                accessibilityHint={t("photoTags.editHint")}
                className="flex-row items-center rounded-full border border-outline-200 px-3 py-1 active:opacity-70"
              >
                <UserPlus size={14} color={IconColors.muted} />
                <Text className="ml-1 text-sm text-typography-500">{t("photoTags.tagPeople")}</Text>
              </Pressable>
            )}
          </HStack>
        )}
      </VStack>
      {saveFailed && (
        <Text className="mt-1 text-xs text-error-600">{t("photoTags.saveFailed")}</Text>
      )}

      {canEdit && (
        <CompanionPickerSheet
          mode="photo"
          useRNModal
          isOpen={isPickerOpen}
          onClose={closePicker}
          options={options ?? null}
          isLoading={loading}
          hasError={!!error}
          selectedUserIds={draftUserIds}
          selectedGroupIds={[]}
          onChange={(selection) => setDraftUserIds(selection.userIds)}
        />
      )}
    </View>
  );
}
