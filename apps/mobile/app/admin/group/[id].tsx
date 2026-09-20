import {
  useAdminGroup,
  useAdminGroupMembers,
  useAdminWinningCriteria,
  useDeleteAdminGroup,
  useUpdateAdminGroup,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Trash2, UsersRound } from "lucide-react-native";
import { useCallback, useState } from "react";

import { useAlertDialog } from "@/components/ui/alert-dialog";
import { ConfirmAlertDialog } from "@/components/ui/alert-dialog/confirm";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

export default function AdminGroupDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  const { group, isLoading, error, refetch } = useAdminGroup(id);
  const { members, isLoading: membersLoading } = useAdminGroupMembers(id);
  const { criteria } = useAdminWinningCriteria();

  // Two mutation instances rather than one shared: the criteria rows and the
  // name/description form each have their own pending state, and sharing it
  // would let a criterion tap disable the form's Save button.
  const updateGroup = useUpdateAdminGroup();
  const updateCriterion = useUpdateAdminGroup();
  const deleteGroup = useDeleteAdminGroup();

  // Draft state is seeded from the loaded group on first edit rather than in an
  // effect, so a background refetch cannot clobber what is being typed.
  const [draft, setDraft] = useState<{ name: string; description: string } | null>(null);

  const startEditing = useCallback(() => {
    if (!group) return;
    setDraft({ name: group.name, description: group.description ?? "" });
  }, [group]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    try {
      await updateGroup.mutate({
        groupId: id,
        data: { name: draft.name.trim(), description: draft.description.trim() || null },
      });
      setDraft(null);
    } catch {
      showDialog(t("common.status.error"), t("admin.mobile.groupDetail.updateError"));
    }
  }, [draft, id, updateGroup, showDialog, t]);

  const handleSelectCriterion = useCallback(
    async (criterionId: number) => {
      // Ignored while a write is in flight. The rows are plain Pressables, so
      // without this a second tap races the first and whichever write lands
      // last at the database wins -- not necessarily the one last tapped.
      if (updateCriterion.loading) return;

      try {
        await updateCriterion.mutate({ groupId: id, data: { winning_criteria_id: criterionId } });
      } catch {
        showDialog(t("common.status.error"), t("admin.mobile.groupDetail.updateError"));
      }
    },
    [id, updateCriterion, showDialog, t],
  );

  const handleDelete = useCallback(() => {
    showDialog(
      t("admin.mobile.groupDetail.deleteGroup"),
      t("admin.mobile.groupDetail.deleteGroupConfirm"),
      "destructive",
      async () => {
        try {
          await deleteGroup.mutate(id);
          router.back();
        } catch {
          showDialog(t("common.status.error"), t("admin.mobile.groupDetail.deleteError"));
        }
      },
    );
  }, [id, deleteGroup, router, showDialog, t]);

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  if (isLoading || !group) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <Text className="text-typography-500">{t("admin.mobile.groupDetail.loading")}</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView className="flex-1 bg-background-50" contentContainerClassName="p-4">
        <VStack space="md">
          {/* Name and description */}
          <Card size="md" variant="elevated">
            <VStack space="sm">
              {draft ? (
                <>
                  <Text className="text-sm text-typography-500">
                    {t("admin.mobile.groupDetail.name")}
                  </Text>
                  <Input>
                    <InputField
                      value={draft.name}
                      onChangeText={(name) => setDraft({ ...draft, name })}
                      accessibilityLabel={t("admin.mobile.groupDetail.name")}
                    />
                  </Input>

                  <Text className="text-sm text-typography-500">
                    {t("admin.mobile.groupDetail.description")}
                  </Text>
                  <Textarea>
                    <TextareaInput
                      value={draft.description}
                      onChangeText={(description) => setDraft({ ...draft, description })}
                      accessibilityLabel={t("admin.mobile.groupDetail.description")}
                    />
                  </Textarea>

                  <HStack space="sm">
                    <Button
                      variant="outline"
                      action="secondary"
                      className="flex-1"
                      onPress={() => setDraft(null)}
                      accessibilityLabel={t("common.buttons.cancel")}
                    >
                      <ButtonText>{t("common.buttons.cancel")}</ButtonText>
                    </Button>
                    <Button
                      className="flex-1"
                      isDisabled={draft.name.trim().length === 0 || updateGroup.loading}
                      onPress={handleSave}
                      accessibilityLabel={t("common.buttons.save")}
                    >
                      {updateGroup.loading && <ButtonSpinner />}
                      <ButtonText>{t("common.buttons.save")}</ButtonText>
                    </Button>
                  </HStack>
                </>
              ) : (
                <>
                  <Text className="text-lg font-semibold text-typography-900">{group.name}</Text>
                  {group.description ? (
                    <Text className="text-sm text-typography-500">{group.description}</Text>
                  ) : (
                    <Text className="text-sm text-typography-400">
                      {t("admin.mobile.groupDetail.noDescription")}
                    </Text>
                  )}
                  <Button
                    variant="outline"
                    onPress={startEditing}
                    accessibilityLabel={t("admin.mobile.groupDetail.edit")}
                  >
                    <ButtonText>{t("admin.mobile.groupDetail.edit")}</ButtonText>
                  </Button>
                </>
              )}
            </VStack>
          </Card>

          {/* Winning criteria */}
          <Card size="md" variant="elevated">
            <VStack space="sm">
              <Text className="text-typography-900">
                {t("admin.mobile.groupDetail.winningCriteria")}
              </Text>
              {criteria.map((criterion, index) => (
                <Pressable
                  key={criterion.id}
                  className={cn(
                    "flex-row items-center justify-between py-3",
                    index < criteria.length - 1 && "border-b border-outline-100",
                    updateCriterion.loading && "opacity-50",
                  )}
                  onPress={() => handleSelectCriterion(criterion.id)}
                  accessibilityRole="button"
                  accessibilityLabel={criterion.name}
                  accessibilityState={{
                    selected: group.winning_criteria_id === criterion.id,
                    disabled: updateCriterion.loading,
                  }}
                >
                  <Text className="text-typography-900">{criterion.name}</Text>
                  {group.winning_criteria_id === criterion.id && (
                    <Check size={20} color={IconColors.primary} />
                  )}
                </Pressable>
              ))}
            </VStack>
          </Card>

          {/* Members */}
          <Card size="md" variant="elevated">
            <VStack space="sm">
              <HStack space="sm" className="items-center">
                <UsersRound size={18} color={IconColors.primary} />
                <Text className="text-typography-900">
                  {t("admin.mobile.groups.memberCount", { count: group.member_count })}
                </Text>
              </HStack>

              {membersLoading && (
                <Text className="text-typography-500">{t("admin.mobile.groupDetail.loading")}</Text>
              )}

              {!membersLoading && members.length === 0 && (
                <Text className="text-typography-500">
                  {t("admin.mobile.groupDetail.noMembers")}
                </Text>
              )}

              {members.map((member, index) => (
                <View
                  key={member.id}
                  className={cn(
                    "py-2",
                    index < members.length - 1 && "border-b border-outline-100",
                  )}
                >
                  <Text className="text-typography-900">
                    {member.full_name || member.username || t("admin.mobile.users.noName")}
                  </Text>
                  {member.username && member.full_name && (
                    <Text className="text-sm text-typography-500">@{member.username}</Text>
                  )}
                </View>
              ))}
            </VStack>
          </Card>

          {/* Delete */}
          <Card size="md" variant="outline" className="border-error-300">
            <VStack space="sm">
              <Text className="text-error-700">{t("admin.mobile.groupDetail.dangerZone")}</Text>
              <Button
                variant="outline"
                action="negative"
                isDisabled={deleteGroup.loading}
                onPress={handleDelete}
                accessibilityLabel={t("admin.mobile.groupDetail.deleteGroup")}
                accessibilityHint={t("admin.mobile.groupDetail.deleteGroupHint")}
              >
                {deleteGroup.loading ? (
                  <ButtonSpinner />
                ) : (
                  <Trash2 size={16} color={IconColors.error} />
                )}
                <ButtonText>{t("admin.mobile.groupDetail.deleteGroup")}</ButtonText>
              </Button>
            </VStack>
          </Card>

          <View className="h-4" />
        </VStack>
      </ScrollView>

      <ConfirmAlertDialog dialog={dialog} onClose={closeDialog} />
    </>
  );
}
