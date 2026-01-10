import { zodResolver } from "@hookform/resolvers/zod";
import { useTents, useAttendanceByDate } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  createDetailedAttendanceFormSchema,
  type DetailedAttendanceForm,
} from "@prostcounter/shared/schemas";
import { format } from "date-fns";
import { X, Calendar } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";

import type { AttendanceWithTotals } from "@prostcounter/shared/schemas";

import { BeerPicturesSection } from "./beer-pictures-section";
import { BeerStepper } from "./beer-stepper";
import { TentSelectorSheet } from "../tent-selector/tent-selector-sheet";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { type PendingPhoto } from "@/hooks/useBeerPictureUpload";
import { useSaveAttendance } from "@/hooks/useSaveAttendance";
import { IconColors } from "@/lib/constants/colors";

interface AttendanceFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  festivalId: string;
  festivalStartDate: Date;
  festivalEndDate: Date;
  selectedDate: Date;
  existingAttendance?: AttendanceWithTotals | null;
  onSuccess?: () => void;
}

interface BeerPicture {
  id: string;
  pictureUrl: string;
}

/**
 * Attendance form sheet for adding/editing attendance records
 *
 * Features:
 * - Date display (from calendar selection)
 * - Beer count stepper (- / count / +)
 * - Tent multi-select via separate sheet
 * - Photo upload section (uploads on save)
 * - React Hook Form with Zod validation
 */
export function AttendanceFormSheet({
  isOpen,
  onClose,
  festivalId,
  festivalStartDate,
  festivalEndDate,
  selectedDate,
  existingAttendance,
  onSuccess,
}: AttendanceFormSheetProps) {
  const { t } = useTranslation();
  const [showTentSelector, setShowTentSelector] = useState(false);
  const [photos, setPhotos] = useState<BeerPicture[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [photosMarkedForRemoval, setPhotosMarkedForRemoval] = useState<
    string[]
  >([]);

  const isEditMode = !!existingAttendance;
  const { tents } = useTents(festivalId);
  const { saveAttendance, isSaving } = useSaveAttendance();

  // Fetch complete attendance data with beer pictures when editing
  const dateString =
    selectedDate && !isNaN(selectedDate.getTime())
      ? format(selectedDate, "yyyy-MM-dd")
      : "";
  const { data: attendanceWithPhotos } = useAttendanceByDate(
    isOpen && isEditMode ? festivalId : "",
    isOpen && isEditMode ? dateString : "",
  );

  // Create dynamic schema based on festival dates
  const formSchema = useMemo(
    () =>
      createDetailedAttendanceFormSchema(festivalStartDate, festivalEndDate),
    [festivalStartDate, festivalEndDate],
  );

  // Default values based on existing attendance or selected date
  const defaultValues = useMemo(() => {
    if (existingAttendance) {
      return {
        amount: existingAttendance.beerCount,
        date: new Date(existingAttendance.date),
        tents: existingAttendance.tentVisits?.map((tv) => tv.tentId) ?? [],
      };
    }
    return {
      amount: 0,
      date: selectedDate,
      tents: [],
    };
  }, [existingAttendance, selectedDate]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DetailedAttendanceForm>({
    resolver: zodResolver(formSchema),
    values: defaultValues,
  });

  const selectedTents = watch("tents");

  // Reset form when opening/closing or date changes
  useEffect(() => {
    if (isOpen) {
      reset(defaultValues);
      // Clear photos when opening - will be populated from API
      setPhotos([]);
      setPendingPhotos([]);
      setPhotosMarkedForRemoval([]);
    }
  }, [isOpen, defaultValues, reset]);

  // Load photos from API when attendance data is fetched
  useEffect(() => {
    if (isOpen && attendanceWithPhotos?.pictures?.length) {
      // Use the pictures array which includes proper IDs for deletion
      setPhotos(
        attendanceWithPhotos.pictures.map(
          (pic: { id: string; pictureUrl: string }) => ({
            id: pic.id,
            pictureUrl: pic.pictureUrl,
          }),
        ),
      );
    }
  }, [isOpen, attendanceWithPhotos]);

  // Update form date when selectedDate changes
  useEffect(() => {
    if (isOpen && !existingAttendance) {
      setValue("date", selectedDate);
    }
  }, [isOpen, selectedDate, existingAttendance, setValue]);

  // Get tent info for display as badges
  const selectedTentInfo = useMemo(() => {
    if (!selectedTents.length) return [];
    const allOptions = tents.flatMap((group) => group.options);
    return selectedTents
      .map((id) => {
        const option = allOptions.find((opt) => opt.value === id);
        return option ? { id, label: option.label } : null;
      })
      .filter((item): item is { id: string; label: string } => item !== null);
  }, [selectedTents, tents]);

  // Handle form submission
  const onSubmit = useCallback(
    async (data: DetailedAttendanceForm) => {
      try {
        await saveAttendance({
          festivalId,
          date: data.date,
          amount: data.amount,
          tents: data.tents,
          existingAttendanceId: existingAttendance?.id,
          pendingPhotos,
          photosToDelete: photosMarkedForRemoval,
        });

        onSuccess?.();
        onClose();
      } catch (error) {
        console.error("Failed to save attendance:", error);
      }
    },
    [
      festivalId,
      existingAttendance,
      pendingPhotos,
      photosMarkedForRemoval,
      saveAttendance,
      onSuccess,
      onClose,
    ],
  );

  const handleTentsSelect = useCallback(
    (tentIds: string[]) => {
      setValue("tents", tentIds, { shouldValidate: true });
    },
    [setValue],
  );

  // Toggle photo marked for removal (clicking X on existing photos)
  const handleTogglePhotoRemoval = useCallback((photoId: string) => {
    setPhotosMarkedForRemoval((prev) =>
      prev.includes(photoId)
        ? prev.filter((id) => id !== photoId)
        : [...prev, photoId],
    );
  }, []);

  // Format date for display - guard against invalid dates
  const formattedDate =
    selectedDate && !isNaN(selectedDate.getTime())
      ? format(selectedDate, "EEEE, MMMM d, yyyy")
      : "Select a date";

  return (
    <>
      <Actionsheet isOpen={isOpen} onClose={onClose}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="max-h-[85%]">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          {/* Header */}
          <HStack className="mb-4 w-full items-center justify-between px-2">
            <Text className="text-lg font-semibold text-typography-900">
              {isEditMode
                ? t("attendance.form.editTitle")
                : t("attendance.form.addTitle")}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={24} color={IconColors.default} />
            </Pressable>
          </HStack>

          <ActionsheetScrollView className="w-full">
            <VStack className="gap-5 px-2 pb-6">
              {/* Date Display */}
              <VStack className="gap-2">
                <Text className="text-sm font-medium text-typography-700">
                  {t("common.labels.date")}
                </Text>
                <HStack className="items-center gap-2 rounded-lg bg-background-100 px-4 py-3">
                  <Calendar size={18} color={IconColors.muted} />
                  <Text className="text-base text-typography-700">
                    {formattedDate}
                  </Text>
                </HStack>
              </VStack>

              {/* Beer Count Stepper */}
              <VStack className="gap-3">
                <Text className="text-center text-sm font-medium text-typography-700">
                  {t("attendance.howManyBeers")}
                </Text>
                <Controller
                  control={control}
                  name="amount"
                  render={({ field: { value, onChange } }) => (
                    <BeerStepper
                      value={value}
                      onChange={onChange}
                      min={0}
                      max={20}
                    />
                  )}
                />
                {errors.amount && (
                  <Text className="text-center text-sm text-error-600">
                    {t(errors.amount.message || "validation.required")}
                  </Text>
                )}
              </VStack>

              {/* Tent Selector */}
              <VStack className="gap-2">
                <Text className="text-sm font-medium text-typography-700">
                  {t("attendance.table.visitedTents")}
                </Text>
                <Pressable
                  onPress={() => setShowTentSelector(true)}
                  className="w-full rounded-lg border border-background-300 bg-background-0 px-4 py-3"
                >
                  {selectedTentInfo.length > 0 ? (
                    <HStack className="flex-wrap gap-2">
                      {selectedTentInfo.map((tent) => (
                        <Badge
                          key={tent.id}
                          action="info"
                          variant="outline"
                          size="md"
                        >
                          <BadgeText className="normal-case">
                            {tent.label}
                          </BadgeText>
                        </Badge>
                      ))}
                    </HStack>
                  ) : (
                    <Text className="text-base text-typography-400">
                      {t("attendance.form.selectTents")}
                    </Text>
                  )}
                </Pressable>
                {errors.tents && (
                  <Text className="text-sm text-error-600">
                    {t(errors.tents.message || "validation.required")}
                  </Text>
                )}
              </VStack>

              {/* Beer Pictures Section */}
              <BeerPicturesSection
                existingPhotos={photos}
                pendingPhotos={pendingPhotos}
                photosMarkedForRemoval={photosMarkedForRemoval}
                onPendingPhotosChange={setPendingPhotos}
                onTogglePhotoRemoval={handleTogglePhotoRemoval}
                isUploading={isSaving}
              />
            </VStack>
          </ActionsheetScrollView>

          {/* Footer Buttons */}
          <HStack className="w-full gap-3 px-2 pt-3">
            <Button
              variant="outline"
              action="secondary"
              className="flex-1"
              onPress={onClose}
              isDisabled={isSaving}
            >
              <ButtonText>{t("common.buttons.cancel")}</ButtonText>
            </Button>
            <Button
              variant="solid"
              action="primary"
              className="flex-1"
              onPress={handleSubmit(onSubmit)}
              isDisabled={isSaving}
            >
              <ButtonText>
                {isSaving
                  ? t("attendance.form.saving")
                  : t("common.buttons.save")}
              </ButtonText>
            </Button>
          </HStack>
        </ActionsheetContent>
      </Actionsheet>

      {/* Tent Selector Sheet */}
      <TentSelectorSheet
        isOpen={showTentSelector}
        onClose={() => setShowTentSelector(false)}
        festivalId={festivalId}
        mode="multi"
        selectedTents={selectedTents}
        onSelectTents={handleTentsSelect}
      />
    </>
  );
}

AttendanceFormSheet.displayName = "AttendanceFormSheet";
