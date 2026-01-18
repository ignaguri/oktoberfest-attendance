import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCancelReservation,
  useCreateReservation,
  useTents,
  useUpdateReservation,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { Reservation } from "@prostcounter/shared/schemas";
import { cn } from "@prostcounter/ui";
import { format, setHours, setMinutes } from "date-fns";
import { ChevronDown, MapPin, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { VStack } from "@/components/ui/vstack";
import { IconColors, SwitchColors } from "@/lib/constants/colors";

import { TentSelectorSheet } from "../../tent-selector/tent-selector-sheet";
import { ReminderOffsetSelect } from "../reservation-form/reminder-offset-select";
import { TimePickerField } from "../reservation-form/time-picker-field";

/**
 * Form schema for reservation
 */
const reservationFormSchema = z.object({
  tentId: z.string().uuid({ message: "Please select a tent" }),
  startTime: z.date(),
  note: z.string().max(500).optional(),
  visibleToGroups: z.boolean(),
  reminderOffsetMinutes: z.number().int().min(0).max(1440),
});

type ReservationFormData = z.infer<typeof reservationFormSchema>;

interface ReservationTabContentProps {
  festivalId: string;
  selectedDate: Date;
  existingReservation?: Reservation | null;
  onSuccess?: () => void;
  onClose: () => void;
}

/**
 * Reservation form tab content
 *
 * Creates or edits tent reservations with:
 * - Single tent selection
 * - Time picker for arrival time
 * - Reminder offset selector
 * - Optional notes
 * - Visible to groups toggle
 * - Cancel reservation (edit mode)
 */
export function ReservationTabContent({
  festivalId,
  selectedDate,
  existingReservation,
  onSuccess,
  onClose,
}: ReservationTabContentProps) {
  const { t } = useTranslation();
  const [showTentSelector, setShowTentSelector] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const isEditMode = !!existingReservation;
  const { tents } = useTents(festivalId);

  // Track last initialized state to prevent infinite loops
  const lastInitializedRef = useRef<{
    dateStr: string;
    reservationId: string | null;
  } | null>(null);

  // Mutations
  const createReservation = useCreateReservation();
  const updateReservation = useUpdateReservation();
  const cancelReservation = useCancelReservation();

  // Parse existing reservation time or default to noon
  const parseExistingTime = useCallback((): Date => {
    if (existingReservation?.startAt) {
      const startDate = new Date(existingReservation.startAt);
      return setMinutes(
        setHours(selectedDate, startDate.getHours()),
        startDate.getMinutes(),
      );
    }
    // Default to noon
    return setMinutes(setHours(selectedDate, 12), 0);
  }, [existingReservation, selectedDate]);

  // Form default values
  const defaultValues = useMemo((): ReservationFormData => {
    if (existingReservation) {
      return {
        tentId: existingReservation.tentId,
        startTime: parseExistingTime(),
        note: existingReservation.note || "",
        visibleToGroups: existingReservation.visibleToGroups,
        reminderOffsetMinutes: existingReservation.reminderOffsetMinutes,
      };
    }
    return {
      tentId: "",
      startTime: parseExistingTime(),
      note: "",
      visibleToGroups: true,
      reminderOffsetMinutes: 30,
    };
  }, [existingReservation, parseExistingTime]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ReservationFormData>({
    resolver: zodResolver(reservationFormSchema),
    defaultValues,
  });

  const selectedTentId = watch("tentId");

  // Format date for tracking
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // Reset form when date or reservation changes
  useEffect(() => {
    const currentState = {
      dateStr,
      reservationId: existingReservation?.id ?? null,
    };

    // Check if we've already initialized for this state
    if (
      lastInitializedRef.current?.dateStr === currentState.dateStr &&
      lastInitializedRef.current?.reservationId === currentState.reservationId
    ) {
      return;
    }

    // Update tracking ref
    lastInitializedRef.current = currentState;

    // Calculate initial values
    const initialValues: ReservationFormData = existingReservation
      ? {
          tentId: existingReservation.tentId,
          startTime: parseExistingTime(),
          note: existingReservation.note || "",
          visibleToGroups: existingReservation.visibleToGroups,
          reminderOffsetMinutes: existingReservation.reminderOffsetMinutes,
        }
      : {
          tentId: "",
          startTime: parseExistingTime(),
          note: "",
          visibleToGroups: true,
          reminderOffsetMinutes: 30,
        };

    reset(initialValues);
  }, [dateStr, existingReservation, parseExistingTime, reset]);

  // Get selected tent name
  const selectedTentName = useMemo(() => {
    if (!selectedTentId) return null;
    const allOptions = tents.flatMap((group) => group.options);
    const option = allOptions.find((opt) => opt.value === selectedTentId);
    return option?.label || null;
  }, [selectedTentId, tents]);

  // Handle form submission
  const onSubmit = useCallback(
    async (data: ReservationFormData) => {
      try {
        // Combine selected date with chosen time
        const startAt = setMinutes(
          setHours(selectedDate, data.startTime.getHours()),
          data.startTime.getMinutes(),
        );

        if (isEditMode && existingReservation) {
          await updateReservation.mutateAsync({
            reservationId: existingReservation.id,
            data: {
              startAt: startAt.toISOString(),
              note: data.note || null,
              visibleToGroups: data.visibleToGroups,
              reminderOffsetMinutes: data.reminderOffsetMinutes,
            },
          });
        } else {
          await createReservation.mutateAsync({
            festivalId,
            tentId: data.tentId,
            startAt: startAt.toISOString(),
            note: data.note || undefined,
            visibleToGroups: data.visibleToGroups,
            reminderOffsetMinutes: data.reminderOffsetMinutes,
          });
        }

        onSuccess?.();
        onClose();
      } catch (error) {
        console.error("Failed to save reservation:", error);
      }
    },
    [
      festivalId,
      selectedDate,
      existingReservation,
      isEditMode,
      createReservation,
      updateReservation,
      onSuccess,
      onClose,
    ],
  );

  // Handle tent selection
  const handleTentSelect = useCallback(
    (tentId: string) => {
      setValue("tentId", tentId, { shouldValidate: true });
    },
    [setValue],
  );

  // Handle cancel reservation
  const handleCancelPress = useCallback(() => {
    setShowCancelConfirm(true);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (!existingReservation?.id) return;

    try {
      await cancelReservation.mutateAsync({
        reservationId: existingReservation.id,
        festivalId,
      });
      setShowCancelConfirm(false);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Failed to cancel reservation:", error);
    }
  }, [
    existingReservation?.id,
    festivalId,
    cancelReservation,
    onSuccess,
    onClose,
  ]);

  const handleDismissCancel = useCallback(() => {
    setShowCancelConfirm(false);
  }, []);

  const isSaving = createReservation.loading || updateReservation.loading;
  const isCancelling = cancelReservation.loading;
  const isProcessing = isSaving || isCancelling;

  return (
    <>
      <VStack space="xl" className="px-2 pb-4">
        {/* Cancel Button - Only in edit mode */}
        {isEditMode && (
          <HStack className="justify-end">
            <Button
              variant="outline"
              action="negative"
              size="sm"
              onPress={handleCancelPress}
              isDisabled={isProcessing}
            >
              <Trash2 size={16} color={IconColors.error} />
              <ButtonText className="ml-2">
                {t("reservation.form.cancelReservation")}
              </ButtonText>
            </Button>
          </HStack>
        )}

        {/* Tent Selector */}
        <VStack space="sm">
          <Text className="text-typography-700 text-sm font-medium">
            {t("reservation.form.tent")}
          </Text>
          <Pressable
            onPress={() => !isEditMode && setShowTentSelector(true)}
            disabled={isEditMode}
            className={cn(
              "border-background-300 bg-background-0 w-full rounded-lg border px-4 py-3",
              isEditMode && "opacity-50",
              errors.tentId && "border-error-500",
            )}
            accessibilityRole="button"
            accessibilityLabel={t("reservation.form.selectTent")}
          >
            <HStack className="items-center justify-between">
              <HStack space="sm" className="items-center">
                <MapPin size={18} color={IconColors.muted} />
                <Text
                  className={cn(
                    "text-base",
                    selectedTentName
                      ? "text-typography-900"
                      : "text-typography-400",
                  )}
                >
                  {selectedTentName || t("reservation.form.selectTent")}
                </Text>
              </HStack>
              {!isEditMode && (
                <ChevronDown size={18} color={IconColors.muted} />
              )}
            </HStack>
          </Pressable>
          {errors.tentId && (
            <Text className="text-error-600 text-sm">
              {t("validation.tentRequired")}
            </Text>
          )}
          {isEditMode && (
            <Text className="text-typography-400 text-xs">
              {t("reservation.form.tentCannotBeChanged")}
            </Text>
          )}
        </VStack>

        {/* Time Picker */}
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

        {/* Reminder Selector */}
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

        {/* Notes Field */}
        <VStack space="sm">
          <Text className="text-typography-700 text-sm font-medium">
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
                  placeholder={t("reservation.form.notePlaceholder")}
                  value={value || ""}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  maxLength={500}
                />
              </Textarea>
            )}
          />
        </VStack>

        {/* Visible to Groups Toggle */}
        <Controller
          control={control}
          name="visibleToGroups"
          render={({ field: { value, onChange } }) => (
            <HStack className="items-center justify-between">
              <VStack>
                <Text className="text-typography-900 text-base font-medium">
                  {t("reservation.form.visibleToGroups")}
                </Text>
                <Text className="text-typography-500 text-sm">
                  {t("reservation.form.visibleToGroupsDescription")}
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

        {/* Footer Buttons */}
        <HStack className="w-full gap-3 pt-3">
          <Button
            variant="outline"
            action="secondary"
            className="flex-1"
            onPress={onClose}
            isDisabled={isProcessing}
          >
            <ButtonText>{t("common.buttons.cancel")}</ButtonText>
          </Button>
          <Button
            variant="solid"
            action="primary"
            className="flex-1"
            onPress={handleSubmit(onSubmit)}
            isDisabled={isProcessing || (!isEditMode && !selectedTentId)}
          >
            <ButtonText>
              {isSaving
                ? t("reservation.form.saving")
                : isEditMode
                  ? t("common.buttons.save")
                  : t("reservation.form.createReservation")}
            </ButtonText>
          </Button>
        </HStack>
      </VStack>

      {/* Tent Selector Sheet */}
      <TentSelectorSheet
        isOpen={showTentSelector}
        onClose={() => setShowTentSelector(false)}
        festivalId={festivalId}
        mode="single"
        selectedTent={selectedTentId}
        onSelectTent={handleTentSelect}
      />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        isOpen={showCancelConfirm}
        onClose={handleDismissCancel}
        size="md"
      >
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="lg" className="text-error-600">
              {t("reservation.form.cancelConfirmTitle")}
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody className="mb-4 mt-3">
            <Text size="sm" className="text-typography-500">
              {t("reservation.form.cancelConfirmMessage")}
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-3">
            <Button
              variant="outline"
              action="secondary"
              onPress={handleDismissCancel}
              className="flex-1"
              isDisabled={isCancelling}
            >
              <ButtonText>{t("common.buttons.back")}</ButtonText>
            </Button>
            <Button
              action="negative"
              onPress={handleConfirmCancel}
              className="flex-1"
              isDisabled={isCancelling}
            >
              <ButtonText>
                {isCancelling
                  ? t("common.status.cancelling")
                  : t("reservation.form.cancelReservation")}
              </ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

ReservationTabContent.displayName = "ReservationTabContent";
