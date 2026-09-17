import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@prostcounter/api-client";
import {
  useDeleteDayPlan,
  usePlanCompanionOptions,
  useUpsertDayPlan,
} from "@prostcounter/shared/hooks";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  DAY_PLAN_NOTE_MAX_LENGTH,
  type DayPlan,
  type DayPlanCompanions,
  type FriendGoing,
} from "@prostcounter/shared/schemas";
import { cn } from "@prostcounter/ui";
import { format } from "date-fns";
import { ChevronDown, MapPin, Users, X } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  useAlertDialog,
} from "@/components/ui/alert-dialog";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { SegmentedControl, type Tab } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { VStack } from "@/components/ui/vstack";
import {
  buildPlannerDefaults,
  plannerFormSchema,
  type PlannerFormValues,
  type PlannerStatus,
  resolveCompanionsInput,
  toUpsertInput,
} from "@/lib/attendance/day-planner-form";
import { formatCompanionNames } from "@/lib/attendance/day-plans";
import { IconColors, SwitchColors } from "@/lib/constants/colors";
import { useAdaptedTents } from "@/lib/database/adapted-hooks";
import { logger } from "@/lib/logger";

import { TentSelectorSheet } from "../../tent-selector/tent-selector-sheet";
import { ReminderOffsetSelect } from "../reservation-form/reminder-offset-select";
import { TimePickerField } from "../reservation-form/time-picker-field";
import { CompanionPickerSheet } from "./companion-picker-sheet";
import { PlanSummaryCard } from "./plan-summary-card";
import { WhosGoingSection } from "./whos-going-section";

interface DayPlannerProps {
  festivalId: string;
  /** The festival's timezone: arrival times are picked and shown on its clock. */
  timezone: string;
  selectedDate: Date;
  /** The user's saved plan or reservation for the day, if any. */
  existingPlan: DayPlan | null;
  /** Friends with a visible plan or reservation on the day. */
  friends: FriendGoing[];
  onSuccess?: () => void;
  onClose: () => void;
}

/**
 * Who else is going, and the user's own status for the day: not going,
 * planning, or reserved.
 *
 * One status per day, so upgrading a plan to a reservation keeps the tent and
 * note and only adds the reservation's fields. Mount with a key per day and
 * plan id: the editing state is per day.
 */
export function DayPlanner({
  festivalId,
  timezone,
  selectedDate,
  existingPlan,
  friends,
  onSuccess,
  onClose,
}: DayPlannerProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(existingPlan === null);
  const [showTentSelector, setShowTentSelector] = useState(false);
  const [showCompanionPicker, setShowCompanionPicker] = useState(false);
  // Saves send companions only once the user touched them; see resolveCompanionsInput
  const [companionsChanged, setCompanionsChanged] = useState(false);
  const { dialog, showDialog, closeDialog } = useAlertDialog();
  const { tents } = useAdaptedTents(festivalId);
  const upsertDayPlan = useUpsertDayPlan();
  const deleteDayPlan = useDeleteDayPlan();
  const {
    data: companionOptions,
    loading: companionOptionsLoading,
    error: companionOptionsError,
    refetch: refetchCompanionOptions,
  } = usePlanCompanionOptions(festivalId, { enabled: isEditing });

  const dateKey = format(selectedDate, "yyyy-MM-dd");
  const defaults = useMemo(
    () => buildPlannerDefaults(existingPlan, selectedDate, timezone),
    [existingPlan, selectedDate, timezone],
  );

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PlannerFormValues>({
    resolver: zodResolver(plannerFormSchema),
    values: defaults,
  });

  const status = watch("status");
  const selectedTentId = watch("tentId");
  const companionUserIds = watch("companionUserIds");
  const companionGroupIds = watch("companionGroupIds");
  const isProcessing = upsertDayPlan.loading || deleteDayPlan.loading;
  // The existing rule for reservations: the tent is fixed once booked.
  const isTentLocked = existingPlan?.kind === "reservation" && status === "reservation";

  const selectedTentName = useMemo(() => {
    if (!selectedTentId) {
      return null;
    }
    const option = tents
      .flatMap((group) => group.options)
      .find((opt) => opt.value === selectedTentId);
    return option?.label ?? null;
  }, [selectedTentId, tents]);

  // Names for the picked ids: the options once loaded, the saved plan until then
  const companionsLabel = useMemo(() => {
    const users = [...(existingPlan?.companions.users ?? []), ...(companionOptions?.users ?? [])];
    const groups = [
      ...(existingPlan?.companions.groups ?? []),
      ...(companionOptions?.groups ?? []),
    ];
    const selected: DayPlanCompanions = {
      users: companionUserIds.flatMap((userId) => {
        const user = users.find((candidate) => candidate.userId === userId);
        return user ? [user] : [];
      }),
      groups: companionGroupIds.flatMap((groupId) => {
        const group = groups.find((candidate) => candidate.groupId === groupId);
        return group ? [group] : [];
      }),
    };

    return formatCompanionNames(selected, {
      viewerId: null,
      you: t("attendance.planner.companionYou"),
      unknown: t("attendance.planner.unknownFriend"),
    });
  }, [existingPlan, companionOptions, companionUserIds, companionGroupIds, t]);

  const handleCompanionsChange = useCallback(
    ({ userIds, groupIds }: { userIds: string[]; groupIds: string[] }) => {
      setValue("companionUserIds", userIds);
      setValue("companionGroupIds", groupIds);
      setCompanionsChanged(true);
    },
    [setValue],
  );

  const statusTabs = useMemo(
    (): Tab[] => [
      { key: "none", label: t("attendance.planner.status.none") },
      { key: "plan", label: t("attendance.planner.status.plan") },
      { key: "reservation", label: t("attendance.planner.status.reservation") },
    ],
    [t],
  );

  const finish = useCallback(() => {
    onSuccess?.();
    onClose();
  }, [onSuccess, onClose]);

  const showSaveFailed = useCallback(() => {
    showDialog(t("common.status.error"), t("attendance.planner.saveFailed"));
  }, [showDialog, t]);

  const removePlan = useCallback(async () => {
    try {
      await deleteDayPlan.mutateAsync({ festivalId, date: dateKey });
      finish();
    } catch (error) {
      logger.error("Failed to remove day plan:", error);
      showSaveFailed();
    }
  }, [deleteDayPlan, festivalId, dateKey, finish, showSaveFailed]);

  const onSubmit = useCallback(
    async (values: PlannerFormValues) => {
      const companions = resolveCompanionsInput(
        values,
        companionsChanged,
        companionOptions ?? null,
      );
      const input = toUpsertInput(values, selectedDate, timezone, companions);

      if (!input) {
        if (!existingPlan) {
          onClose();
          return;
        }
        if (existingPlan.kind === "reservation") {
          showDialog(
            t("reservation.form.cancelConfirmTitle"),
            t("reservation.form.cancelConfirmMessage"),
            "destructive",
            () => {
              void removePlan();
            },
          );
          return;
        }
        await removePlan();
        return;
      }

      try {
        await upsertDayPlan.mutateAsync({ festivalId, date: dateKey, input });
        finish();
      } catch (error) {
        // Someone picked was unfriended or left the group since the list loaded:
        // reload it, so the next save drops them
        if (error instanceof ApiError && error.code === ErrorCodes.DAY_PLAN_INVALID_COMPANION) {
          refetchCompanionOptions();
          showDialog(
            t("common.status.error"),
            t(`apiErrors.${ErrorCodes.DAY_PLAN_INVALID_COMPANION}`),
          );
          return;
        }
        logger.error("Failed to save day plan:", error);
        showSaveFailed();
      }
    },
    [
      companionsChanged,
      companionOptions,
      selectedDate,
      timezone,
      existingPlan,
      onClose,
      showDialog,
      t,
      removePlan,
      upsertDayPlan,
      festivalId,
      dateKey,
      finish,
      showSaveFailed,
      refetchCompanionOptions,
    ],
  );

  const handleCancelEdit = useCallback(() => {
    if (!existingPlan) {
      onClose();
      return;
    }
    reset(defaults);
    setCompanionsChanged(false);
    setIsEditing(false);
  }, [existingPlan, onClose, reset, defaults]);

  return (
    <>
      <VStack space="xl" className="px-2 pb-4">
        <WhosGoingSection friends={friends} timezone={timezone} />

        <VStack space="md">
          <Text className="text-base font-semibold text-typography-900">
            {t("attendance.planner.you")}
          </Text>

          {!isEditing && existingPlan ? (
            <PlanSummaryCard
              plan={existingPlan}
              timezone={timezone}
              onEdit={() => setIsEditing(true)}
            />
          ) : (
            <VStack space="lg">
              <Controller
                control={control}
                name="status"
                render={({ field: { value, onChange } }) => (
                  <SegmentedControl
                    tabs={statusTabs}
                    activeTab={value}
                    onTabChange={(key) => onChange(key as PlannerStatus)}
                  />
                )}
              />

              {status !== "none" && (
                <VStack space="lg">
                  <VStack space="sm">
                    <Text className="text-sm font-medium text-typography-700">
                      {status === "plan"
                        ? t("attendance.planner.tentOptional")
                        : t("reservation.form.tent")}
                    </Text>
                    <Pressable
                      onPress={() => setShowTentSelector(true)}
                      disabled={isTentLocked || isProcessing}
                      className={cn(
                        "w-full rounded-lg border border-background-300 bg-background-0 px-4 py-3",
                        isTentLocked && "opacity-50",
                        errors.tentId && "border-error-500",
                      )}
                      accessibilityRole="button"
                      accessibilityLabel={t("reservation.form.selectTent")}
                    >
                      <HStack className="items-center justify-between">
                        <HStack space="sm" className="flex-1 items-center">
                          <MapPin size={18} color={IconColors.muted} />
                          <Text
                            className={cn(
                              "flex-1 text-base",
                              selectedTentName ? "text-typography-900" : "text-typography-400",
                            )}
                            numberOfLines={1}
                          >
                            {selectedTentName || t("reservation.form.selectTent")}
                          </Text>
                        </HStack>
                        {status === "plan" && selectedTentId ? (
                          <Pressable
                            onPress={() => setValue("tentId", "", { shouldValidate: true })}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={t("attendance.planner.clearTent")}
                          >
                            <X size={18} color={IconColors.muted} />
                          </Pressable>
                        ) : (
                          !isTentLocked && <ChevronDown size={18} color={IconColors.muted} />
                        )}
                      </HStack>
                    </Pressable>
                    {errors.tentId && (
                      <Text className="text-sm text-error-600">{t("validation.tentRequired")}</Text>
                    )}
                    {isTentLocked && (
                      <Text className="text-xs text-typography-400">
                        {t("reservation.form.tentCannotBeChanged")}
                      </Text>
                    )}
                  </VStack>

                  <VStack space="sm">
                    <Text className="text-sm font-medium text-typography-700">
                      {t("attendance.planner.goingWith")}
                    </Text>
                    <Pressable
                      onPress={() => setShowCompanionPicker(true)}
                      disabled={isProcessing}
                      className="w-full rounded-lg border border-background-300 bg-background-0 px-4 py-3"
                      accessibilityRole="button"
                      accessibilityLabel={t("attendance.planner.goingWith")}
                      accessibilityValue={{ text: companionsLabel || undefined }}
                    >
                      <HStack className="items-center justify-between">
                        <HStack space="sm" className="flex-1 items-center">
                          <Users size={18} color={IconColors.muted} />
                          <Text
                            className={cn(
                              "flex-1 text-base",
                              companionsLabel ? "text-typography-900" : "text-typography-400",
                            )}
                            numberOfLines={1}
                          >
                            {companionsLabel || t("attendance.planner.companionsPlaceholder")}
                          </Text>
                        </HStack>
                        {companionsLabel ? (
                          <Pressable
                            onPress={() => handleCompanionsChange({ userIds: [], groupIds: [] })}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={t("attendance.planner.clearCompanions")}
                          >
                            <X size={18} color={IconColors.muted} />
                          </Pressable>
                        ) : (
                          <ChevronDown size={18} color={IconColors.muted} />
                        )}
                      </HStack>
                    </Pressable>
                  </VStack>

                  {status === "reservation" && (
                    <>
                      <Controller
                        control={control}
                        name="startTime"
                        render={({ field: { value, onChange } }) => (
                          <TimePickerField
                            selectedDate={selectedDate}
                            value={value}
                            onChange={onChange}
                            label={t("reservation.form.arrivalTime")}
                            disabled={isProcessing}
                            error={errors.startTime?.message}
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="reminderOffsetMinutes"
                        render={({ field: { value, onChange } }) => (
                          <ReminderOffsetSelect
                            value={value}
                            onChange={onChange}
                            label={t("reservation.form.reminder")}
                            disabled={isProcessing}
                          />
                        )}
                      />
                    </>
                  )}

                  <VStack space="sm">
                    <Text className="text-sm font-medium text-typography-700">
                      {t("reservation.form.note")}
                    </Text>
                    <Controller
                      control={control}
                      name="note"
                      render={({ field: { value, onChange, onBlur } }) => (
                        <Textarea
                          size="md"
                          isDisabled={isProcessing}
                          className="border-background-300"
                        >
                          <TextareaInput
                            placeholder={t("attendance.planner.notePlaceholder")}
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            maxLength={DAY_PLAN_NOTE_MAX_LENGTH}
                          />
                        </Textarea>
                      )}
                    />
                  </VStack>

                  <Controller
                    control={control}
                    name="visibleToGroups"
                    render={({ field: { value, onChange } }) => (
                      <HStack space="md" className="items-center justify-between">
                        <VStack className="flex-1">
                          <Text className="text-base font-medium text-typography-900">
                            {t("attendance.planner.visibility")}
                          </Text>
                          <Text className="text-sm text-typography-500">
                            {t("attendance.planner.visibilityDescription")}
                          </Text>
                        </VStack>
                        <Switch
                          value={value}
                          onValueChange={onChange}
                          disabled={isProcessing}
                          trackColor={{
                            false: SwitchColors.trackOff,
                            true: SwitchColors.trackOn,
                          }}
                        />
                      </HStack>
                    )}
                  />

                  {status === "plan" && (
                    <Text className="text-center text-xs text-typography-500">
                      {t("attendance.planner.reservationHint")}
                    </Text>
                  )}
                </VStack>
              )}

              <HStack className="w-full gap-3 pt-2">
                <Button
                  variant="outline"
                  action="secondary"
                  className="flex-1"
                  onPress={handleCancelEdit}
                  isDisabled={isProcessing}
                >
                  <ButtonText>{t("common.buttons.cancel")}</ButtonText>
                </Button>
                <Button
                  variant="solid"
                  action="primary"
                  className="flex-1"
                  onPress={handleSubmit(onSubmit)}
                  isDisabled={isProcessing}
                >
                  <ButtonText>
                    {isProcessing ? t("reservation.form.saving") : t("common.buttons.save")}
                  </ButtonText>
                </Button>
              </HStack>
            </VStack>
          )}
        </VStack>
      </VStack>

      <TentSelectorSheet
        isOpen={showTentSelector}
        onClose={() => setShowTentSelector(false)}
        festivalId={festivalId}
        mode="single"
        selectedTent={selectedTentId}
        onSelectTent={(tentId) => setValue("tentId", tentId, { shouldValidate: true })}
      />

      <CompanionPickerSheet
        isOpen={showCompanionPicker}
        onClose={() => setShowCompanionPicker(false)}
        options={companionOptions ?? null}
        isLoading={companionOptionsLoading}
        hasError={!!companionOptionsError}
        selectedUserIds={companionUserIds}
        selectedGroupIds={companionGroupIds}
        onChange={handleCompanionsChange}
      />

      <AlertDialog isOpen={dialog.isOpen} onClose={closeDialog} size="md">
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading
              size="lg"
              className={dialog.type === "destructive" ? "text-error-600" : "text-typography-950"}
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
                  <ButtonText>{t("common.buttons.back")}</ButtonText>
                </Button>
                <Button
                  action="negative"
                  onPress={() => {
                    dialog.onConfirm?.();
                    closeDialog();
                  }}
                  className="flex-1"
                >
                  <ButtonText>{t("reservation.form.cancelReservation")}</ButtonText>
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
    </>
  );
}

DayPlanner.displayName = "DayPlanner";
