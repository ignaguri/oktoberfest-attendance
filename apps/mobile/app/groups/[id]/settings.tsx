import { zodResolver } from "@hookform/resolvers/zod";
import {
  useGroupSettings,
  useGroupMembers,
  useUpdateGroup,
  useRemoveMember,
  useLeaveGroup,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { GroupMember, WinningCriteria } from "@prostcounter/shared/schemas";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Save, LogOut, Users, Settings as SettingsIcon } from "lucide-react-native";
import { useCallback, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { RefreshControl, ScrollView } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { z } from "zod";

import { GroupMembersList } from "@/components/groups/group-members-list";
import { InviteLinkSection } from "@/components/groups/invite-link-section";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  useAlertDialog,
} from "@/components/ui/alert-dialog";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/lib/auth/AuthContext";
import { Colors, IconColors } from "@/lib/constants/colors";

// Form validation schema
const UpdateGroupFormSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(100, "Group name must be 100 characters or less"),
  description: z.string().max(500).optional().nullable(),
  winningCriteria: z.enum(["days_attended", "total_beers", "avg_beers"]),
});

type UpdateGroupFormData = z.infer<typeof UpdateGroupFormSchema>;

const WINNING_CRITERIA_OPTIONS = [
  { value: "total_beers", label: "groups.criteria.totalBeers", defaultLabel: "Total Beers" },
  { value: "days_attended", label: "groups.criteria.daysAttended", defaultLabel: "Days Attended" },
  { value: "avg_beers", label: "groups.criteria.avgBeers", defaultLabel: "Avg Beers per Day" },
] as const;

// Map criteria string to ID for API
const CRITERIA_TO_ID: Record<WinningCriteria, number> = {
  days_attended: 1,
  total_beers: 2,
  avg_beers: 3,
};

export default function GroupSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  // Fetch group settings
  const {
    data: groupResponse,
    loading: isLoadingGroup,
    error: groupError,
    refetch: refetchGroup,
    isRefetching: isRefetchingGroup,
  } = useGroupSettings(id || "");

  const group = groupResponse?.data;

  // Fetch members
  const {
    data: members,
    loading: isLoadingMembers,
    refetch: refetchMembers,
    isRefetching: isRefetchingMembers,
  } = useGroupMembers(id || "");

  // Mutations
  const updateGroup = useUpdateGroup();
  const removeMember = useRemoveMember();
  const leaveGroup = useLeaveGroup();

  const isCreator = user?.id === group?.createdBy;
  const isLoading = isLoadingGroup || isLoadingMembers;
  const isRefetching = isRefetchingGroup || isRefetchingMembers;

  // Form setup
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateGroupFormData>({
    resolver: zodResolver(UpdateGroupFormSchema),
    values: group
      ? {
          name: group.name,
          description: group.description || "",
          winningCriteria: group.winningCriteria,
        }
      : undefined,
  });

  // Handle save
  const onSubmit = useCallback(
    async (data: UpdateGroupFormData) => {
      if (!id) return;

      try {
        await updateGroup.mutateAsync({
          groupId: id,
          updates: {
            name: data.name,
            description: data.description || null,
            winningCriteriaId: CRITERIA_TO_ID[data.winningCriteria],
          },
        });
        refetchGroup();
        showDialog(
          t("common.status.success"),
          t("groups.settings.updateSuccess", {
            defaultValue: "Group settings updated successfully!",
          }),
        );
      } catch (error) {
        console.error("Failed to update group:", error);
        showDialog(
          t("common.status.error"),
          t("groups.settings.updateError", {
            defaultValue: "Failed to update group settings.",
          }),
        );
      }
    },
    [id, updateGroup, refetchGroup, showDialog, t],
  );

  // Handle remove member
  const handleRemoveMember = useCallback(
    (userId: string, memberName: string) => {
      showDialog(
        t("groups.settings.removeMemberTitle", { defaultValue: "Remove Member" }),
        t("groups.settings.removeMemberMessage", {
          defaultValue: `Are you sure you want to remove ${memberName} from the group?`,
          name: memberName,
        }),
        "destructive",
        async () => {
          try {
            await removeMember.mutateAsync({ groupId: id!, userId });
            refetchMembers();
          } catch (error) {
            console.error("Failed to remove member:", error);
          }
        },
      );
    },
    [id, removeMember, refetchMembers, showDialog, t],
  );

  // Handle leave group
  const handleLeaveGroup = useCallback(() => {
    showDialog(
      t("groups.settings.leaveTitle", { defaultValue: "Leave Group" }),
      t("groups.settings.leaveMessage", {
        defaultValue: "Are you sure you want to leave this group? You can rejoin later with an invite.",
      }),
      "destructive",
      async () => {
        try {
          await leaveGroup.mutateAsync({ groupId: id!, userId: user?.id || "" });
          router.replace("/(tabs)/groups");
        } catch (error) {
          console.error("Failed to leave group:", error);
        }
      },
    );
  }, [id, user?.id, leaveGroup, router, showDialog, t]);

  // Handle refresh
  const onRefresh = useCallback(() => {
    refetchGroup();
    refetchMembers();
  }, [refetchGroup, refetchMembers]);

  // Loading state
  if (isLoading && !group) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <Spinner size="large" />
      </View>
    );
  }

  // Error state
  if (groupError) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <ErrorState error={groupError} onRetry={refetchGroup} />
      </View>
    );
  }

  // No group found
  if (!group) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50 p-6">
        <SettingsIcon size={48} color={IconColors.disabled} />
        <Text className="mt-4 text-center text-typography-500">
          {t("groups.settings.notFound", { defaultValue: "Group not found" })}
        </Text>
        <Button
          variant="outline"
          action="secondary"
          className="mt-4"
          onPress={() => router.back()}
        >
          <ButtonText>{t("common.buttons.goBack", { defaultValue: "Go Back" })}</ButtonText>
        </Button>
      </View>
    );
  }

  const isSaving = updateGroup.loading;
  const isRemovingMember = removeMember.loading;
  const isLeaving = leaveGroup.loading;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView
        className="flex-1 bg-background-50"
        refreshControl={
          <RefreshControl refreshing={isRefetching ?? false} onRefresh={onRefresh} />
        }
      >
        <VStack space="lg" className="p-4 pb-8">
          {/* Group Details Card */}
          {isCreator && (
            <Card variant="elevated" size="lg" className="bg-background-0">
              <VStack space="lg">
                <HStack space="sm" className="items-center">
                  <SettingsIcon size={18} color={IconColors.primary} />
                  <Text className="font-medium text-typography-900">
                    {t("groups.settings.details", { defaultValue: "Group Details" })}
                  </Text>
                </HStack>

                {/* Group Name */}
                <VStack space="sm">
                  <Text className="text-sm font-medium text-typography-700">
                    {t("groups.create.nameLabel", { defaultValue: "Group Name" })}
                  </Text>
                  <Controller
                    control={control}
                    name="name"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input size="md">
                        <InputField
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          autoCapitalize="words"
                        />
                      </Input>
                    )}
                  />
                  {errors.name && (
                    <Text className="text-sm text-error-600">
                      {errors.name.message}
                    </Text>
                  )}
                </VStack>

                {/* Description */}
                <VStack space="sm">
                  <Text className="text-sm font-medium text-typography-700">
                    {t("groups.settings.description", { defaultValue: "Description" })}
                  </Text>
                  <Controller
                    control={control}
                    name="description"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Textarea size="md">
                        <TextareaInput
                          placeholder={t("groups.settings.descriptionPlaceholder", {
                            defaultValue: "Add a description for your group...",
                          })}
                          value={value || ""}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          numberOfLines={3}
                        />
                      </Textarea>
                    )}
                  />
                  {errors.description && (
                    <Text className="text-sm text-error-600">
                      {errors.description.message}
                    </Text>
                  )}
                </VStack>

                {/* Winning Criteria */}
                <VStack space="sm">
                  <Text className="text-sm font-medium text-typography-700">
                    {t("groups.create.criteriaLabel", { defaultValue: "Winning Criteria" })}
                  </Text>
                  <Controller
                    control={control}
                    name="winningCriteria"
                    render={({ field: { onChange, value } }) => (
                      <Select selectedValue={value} onValueChange={onChange}>
                        <SelectTrigger variant="outline" size="md">
                          <SelectInput
                            value={
                              WINNING_CRITERIA_OPTIONS.find((opt) => opt.value === value)
                                ? t(
                                    WINNING_CRITERIA_OPTIONS.find((opt) => opt.value === value)!
                                      .label,
                                    {
                                      defaultValue: WINNING_CRITERIA_OPTIONS.find(
                                        (opt) => opt.value === value,
                                      )!.defaultLabel,
                                    },
                                  )
                                : ""
                            }
                          />
                          <SelectIcon className="mr-3" />
                        </SelectTrigger>
                        <SelectPortal>
                          <SelectBackdrop />
                          <SelectContent>
                            <SelectDragIndicatorWrapper>
                              <SelectDragIndicator />
                            </SelectDragIndicatorWrapper>
                            {WINNING_CRITERIA_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                label={t(option.label, { defaultValue: option.defaultLabel })}
                                value={option.value}
                              />
                            ))}
                          </SelectContent>
                        </SelectPortal>
                      </Select>
                    )}
                  />
                </VStack>

                {/* Save Button */}
                <Button
                  variant="solid"
                  action="primary"
                  size="md"
                  onPress={handleSubmit(onSubmit)}
                  isDisabled={!isDirty || isSaving}
                >
                  {isSaving ? (
                    <ButtonSpinner color={Colors.white} />
                  ) : (
                    <Save size={18} color={IconColors.white} />
                  )}
                  <ButtonText className="ml-2">
                    {isSaving
                      ? t("common.status.saving", { defaultValue: "Saving..." })
                      : t("common.buttons.save", { defaultValue: "Save Changes" })}
                  </ButtonText>
                </Button>
              </VStack>
            </Card>
          )}

          {/* Invite Link Section (Creator only) */}
          {isCreator && (
            <InviteLinkSection
              groupId={id!}
              groupName={group.name}
              inviteToken={group.inviteToken}
              onTokenUpdated={refetchGroup}
            />
          )}

          {/* Members Section */}
          <VStack space="sm">
            <HStack space="sm" className="items-center">
              <Users size={18} color={IconColors.default} />
              <Text className="font-medium text-typography-900">
                {t("groups.settings.members", { defaultValue: "Members" })}
              </Text>
              <Text className="text-sm text-typography-500">
                ({(members as GroupMember[])?.length || 0})
              </Text>
              {isLoadingMembers && <Spinner size="small" />}
            </HStack>

            <GroupMembersList
              members={(members as GroupMember[]) || []}
              currentUserId={user?.id}
              creatorId={group.createdBy}
              isCreator={isCreator}
              onRemoveMember={handleRemoveMember}
              isRemoving={isRemovingMember}
            />
          </VStack>

          {/* Leave Group Section */}
          <Card variant="outline" size="md" className="border-error-200">
            <VStack space="sm">
              <Text className="font-medium text-error-600">
                {t("groups.settings.dangerZone", { defaultValue: "Danger Zone" })}
              </Text>
              <Text className="text-sm text-typography-500">
                {isCreator
                  ? t("groups.settings.leaveCreatorWarning", {
                      defaultValue:
                        "As the group creator, leaving will transfer ownership to another member.",
                    })
                  : t("groups.settings.leaveWarning", {
                      defaultValue: "You can rejoin later with an invite link.",
                    })}
              </Text>
              <Button
                variant="outline"
                action="negative"
                size="md"
                onPress={handleLeaveGroup}
                isDisabled={isLeaving}
              >
                {isLeaving ? (
                  <ButtonSpinner color={Colors.error[600]} />
                ) : (
                  <LogOut size={18} color={IconColors.error} />
                )}
                <ButtonText className="ml-2">
                  {t("groups.settings.leave", { defaultValue: "Leave Group" })}
                </ButtonText>
              </Button>
            </VStack>
          </Card>
        </VStack>
      </ScrollView>

      {/* Alert Dialog */}
      <AlertDialog isOpen={dialog.isOpen} onClose={closeDialog} size="md">
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading
              size="lg"
              className={
                dialog.type === "destructive"
                  ? "text-error-600"
                  : "text-typography-950"
              }
            >
              {dialog.title}
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody className="mb-4 mt-3">
            <Text size="sm" className="text-typography-500">
              {dialog.message}
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-3">
            {dialog.onConfirm ? (
              <>
                <Button
                  variant="outline"
                  action="secondary"
                  onPress={closeDialog}
                  className="flex-1"
                >
                  <ButtonText>{t("common.buttons.cancel")}</ButtonText>
                </Button>
                <Button
                  action={dialog.type === "destructive" ? "negative" : "primary"}
                  onPress={() => {
                    dialog.onConfirm?.();
                    closeDialog();
                  }}
                  className="flex-1"
                >
                  <ButtonText>
                    {dialog.type === "destructive"
                      ? t("common.buttons.confirm", { defaultValue: "Confirm" })
                      : t("common.buttons.ok")}
                  </ButtonText>
                </Button>
              </>
            ) : (
              <Button action="primary" onPress={closeDialog} className="flex-1">
                <ButtonText>{t("common.buttons.ok")}</ButtonText>
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GestureHandlerRootView>
  );
}
