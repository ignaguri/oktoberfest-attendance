import { zodResolver } from "@hookform/resolvers/zod";
import {
  useAttendanceByDate,
  useConsumptions,
  useDeleteAttendance,
  useTents,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type {
  AttendanceWithTotals,
  TentVisit,
} from "@prostcounter/shared/schemas";
import {
  createDetailedAttendanceFormSchema,
  type DetailedAttendanceForm,
  type DrinkType,
} from "@prostcounter/shared/schemas";
import { format, parseISO } from "date-fns";
import { Calendar, Trash2, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { type PendingPhoto } from "@/hooks/useBeerPictureUpload";
import { useSaveAttendance } from "@/hooks/useSaveAttendance";
import { IconColors } from "@/lib/constants/colors";

import { TentSelectorSheet } from "../tent-selector/tent-selector-sheet";
import { BeerPicturesSection } from "./beer-pictures-section";
import { DrinkTypePicker } from "./drink-type-picker";
import { LocalDrinkStepper } from "./local-drink-stepper";

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

interface TentVisitDisplay {
  id: string;
  visitDate: string;
  label: string;
  checkInTime: string;
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
  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>("beer");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Local drink counts - tracks desired counts before save
  const [localDrinkCounts, setLocalDrinkCounts] = useState<
    Record<DrinkType, number>
  >({
    beer: 0,
    radler: 0,
    wine: 0,
    soft_drink: 0,
    alcohol_free: 0,
    other: 0,
  });

  const isEditMode = !!existingAttendance;
  const { tents } = useTents(festivalId);
  const { saveAttendance, isSaving } = useSaveAttendance();
  const deleteAttendance = useDeleteAttendance();

  // Format date string for API calls
  const dateString =
    selectedDate && !isNaN(selectedDate.getTime())
      ? format(selectedDate, "yyyy-MM-dd")
      : "";

  // Fetch consumptions for this date
  const { data: consumptionsData } = useConsumptions(
    isOpen ? festivalId : "",
    isOpen ? dateString : "",
  );
  const consumptions = consumptionsData || [];

  // Calculate counts per drink type from API consumptions (initial values)
  const drinkCounts = useMemo(() => {
    const counts: Record<DrinkType, number> = {
      beer: 0,
      radler: 0,
      wine: 0,
      soft_drink: 0,
      alcohol_free: 0,
      other: 0,
    };
    for (const c of consumptions) {
      if (counts[c.drinkType] !== undefined) {
        counts[c.drinkType]++;
      }
    }
    return counts;
  }, [consumptions]);

  // Calculate total local drinks
  const totalLocalDrinks = useMemo(() => {
    return Object.values(localDrinkCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
  }, [localDrinkCounts]);

  // Track previous isOpen state to detect when sheet opens
  const prevIsOpenRef = useRef(isOpen);

  // Fetch complete attendance data with beer pictures when editing
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

  // Use fresh tent visits from API when available, fall back to prop data
  const freshTentVisits: TentVisit[] =
    attendanceWithPhotos?.tentVisits ?? existingAttendance?.tentVisits ?? [];

  // Default values based on existing attendance or selected date
  // Use unique tent IDs for the form (for tent selector)
  const defaultValues = useMemo(() => {
    if (existingAttendance) {
      // Get unique tent IDs from tent visits
      const uniqueTentIds: string[] = [
        ...new Set(freshTentVisits.map((tv: TentVisit) => tv.tentId)),
      ];
      return {
        amount:
          existingAttendance.drinkCount || existingAttendance.beerCount || 0,
        date: new Date(existingAttendance.date),
        tents: uniqueTentIds,
      };
    }
    return {
      amount: consumptions.length,
      date: selectedDate,
      tents: [] as string[],
    };
  }, [existingAttendance, selectedDate, consumptions.length, freshTentVisits]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DetailedAttendanceForm>({
    resolver: zodResolver(formSchema),
    // Use defaultValues for initial state only - don't use `values` as it continuously syncs
    // and would override user changes to tents
    defaultValues,
  });

  const selectedTents = watch("tents");

  // Track if we've initialized local counts for this session
  const hasInitializedCountsRef = useRef(false);

  // Reset form only when sheet opens (not when data updates during save)
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (justOpened) {
      reset(defaultValues);
      // Clear photos when opening - will be populated from API
      setPhotos([]);
      setPendingPhotos([]);
      setPhotosMarkedForRemoval([]);
      // Reset local drink counts to zero when opening
      setLocalDrinkCounts({
        beer: 0,
        radler: 0,
        wine: 0,
        soft_drink: 0,
        alcohol_free: 0,
        other: 0,
      });
      // Reset selected drink type to beer
      setSelectedDrinkType("beer");
      // Reset the initialized flag when sheet opens
      hasInitializedCountsRef.current = false;
    }

    if (!isOpen) {
      hasInitializedCountsRef.current = false;
    }
  }, [isOpen, defaultValues, reset]);

  // Initialize local drink counts when consumptions are loaded
  useEffect(() => {
    if (isOpen && !hasInitializedCountsRef.current && consumptions.length > 0) {
      setLocalDrinkCounts(drinkCounts);
      hasInitializedCountsRef.current = true;
    }
  }, [isOpen, consumptions.length, drinkCounts]);

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

  // Keep form amount field in sync with total local drinks for validation
  useEffect(() => {
    if (isOpen) {
      setValue("amount", totalLocalDrinks);
    }
  }, [isOpen, totalLocalDrinks, setValue]);

  // Get tent visits for display as badges (showing ALL visits with times)
  // These are historical visits - displayed chronologically
  const tentVisitsForDisplay = useMemo((): TentVisitDisplay[] => {
    if (!freshTentVisits.length) return [];
    const allOptions = tents.flatMap((group) => group.options);
    return freshTentVisits
      .map((visit: TentVisit) => {
        const option = allOptions.find((opt) => opt.value === visit.tentId);
        const label = option?.label || visit.tentName || "Unknown Tent";
        const checkInTime = format(parseISO(visit.visitDate), "HH:mm");
        // Use visitDate as part of key for uniqueness
        return {
          id: visit.tentId,
          visitDate: visit.visitDate,
          label,
          checkInTime,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime(),
      );
  }, [freshTentVisits, tents]);

  // Get selected tents from form - these are what user currently has selected
  // Shows tents that will be added on save (may include ones already visited)
  const selectedTentInfo = useMemo(() => {
    if (!selectedTents.length) return [];
    const allOptions = tents.flatMap((group) => group.options);
    return selectedTents
      .map((id) => {
        const option = allOptions.find((opt) => opt.value === id);
        if (!option) return null;
        return { id, label: option.label };
      })
      .filter((item): item is { id: string; label: string } => item !== null);
  }, [selectedTents, tents]);

  // Combined display: show selected tents from form, with timestamps for those that have visits
  const combinedTentDisplay = useMemo(() => {
    const allOptions = tents.flatMap((group) => group.options);

    // Build a map of tent visits by tent ID (most recent visit for each tent)
    const latestVisitByTent = new Map<
      string,
      { visitDate: string; checkInTime: string }
    >();
    for (const visit of freshTentVisits) {
      const existing = latestVisitByTent.get(visit.tentId);
      if (
        !existing ||
        new Date(visit.visitDate) > new Date(existing.visitDate)
      ) {
        latestVisitByTent.set(visit.tentId, {
          visitDate: visit.visitDate,
          checkInTime: format(parseISO(visit.visitDate), "HH:mm"),
        });
      }
    }

    // Create display items for each selected tent
    return selectedTents.map((tentId) => {
      const option = allOptions.find((opt) => opt.value === tentId);
      const label = option?.label || "Unknown Tent";
      const visitInfo = latestVisitByTent.get(tentId);

      return {
        id: tentId,
        label,
        checkInTime: visitInfo?.checkInTime || null, // null means not yet visited
      };
    });
  }, [selectedTents, freshTentVisits, tents]);

  // Handle form submission
  const onSubmit = useCallback(
    async (data: DetailedAttendanceForm) => {
      try {
        await saveAttendance({
          festivalId,
          date: data.date,
          amount: totalLocalDrinks, // Use total from local counts
          tents: data.tents,
          existingAttendanceId: existingAttendance?.id,
          pendingPhotos,
          photosToDelete: photosMarkedForRemoval,
          // Pass local counts and existing consumptions for sync
          localDrinkCounts,
          existingConsumptions: consumptions,
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
      totalLocalDrinks,
      localDrinkCounts,
      consumptions,
    ],
  );

  const handleTentsSelect = useCallback(
    (tentIds: string[]) => {
      setValue("tents", tentIds, { shouldValidate: true });
    },
    [setValue],
  );

  // Handle local drink count change (without API call)
  const handleLocalDrinkCountChange = useCallback(
    (drinkType: DrinkType, newCount: number) => {
      setLocalDrinkCounts((prev) => ({
        ...prev,
        [drinkType]: newCount,
      }));
    },
    [],
  );

  // Toggle photo marked for removal (clicking X on existing photos)
  const handleTogglePhotoRemoval = useCallback((photoId: string) => {
    setPhotosMarkedForRemoval((prev) =>
      prev.includes(photoId)
        ? prev.filter((id) => id !== photoId)
        : [...prev, photoId],
    );
  }, []);

  // Handle delete attendance
  const handleDeletePress = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!existingAttendance?.id) return;

    try {
      await deleteAttendance.mutateAsync(existingAttendance.id);
      setShowDeleteConfirm(false);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Failed to delete attendance:", error);
    }
  }, [existingAttendance?.id, deleteAttendance, onSuccess, onClose]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  const isDeleting = deleteAttendance.loading;
  const isProcessing = isSaving || isDeleting;

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
            <Text className="text-typography-900 text-lg font-semibold">
              {isEditMode
                ? t("attendance.form.editTitle")
                : t("attendance.form.addTitle")}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={24} color={IconColors.default} />
            </Pressable>
          </HStack>

          <ActionsheetScrollView className="w-full">
            <VStack space="xl" className="px-2 pb-4">
              {/* Date Display */}
              <VStack space="sm">
                <Text className="text-typography-700 text-sm font-medium">
                  {t("common.labels.date")}
                </Text>
                <HStack space="lg" className="items-center justify-between">
                  <HStack
                    space="sm"
                    className="bg-background-100 flex-1 items-center rounded-lg px-4 py-3"
                  >
                    <Calendar size={18} color={IconColors.muted} />
                    <Text className="text-typography-700 text-base">
                      {formattedDate}
                    </Text>
                  </HStack>
                  {/* Delete Button - Only in edit mode */}
                  {isEditMode && (
                    <Button
                      variant="outline"
                      action="negative"
                      size="icon"
                      onPress={handleDeletePress}
                      isDisabled={isProcessing}
                    >
                      <Trash2 size={18} color={IconColors.error} />
                    </Button>
                  )}
                </HStack>
              </VStack>

              {/* Drink Type Picker & Stepper */}
              <VStack space="md">
                <Text className="text-typography-700 text-center text-sm font-medium">
                  {t("attendance.howManyDrinks")}
                </Text>

                {/* Drink Type Icons */}
                <DrinkTypePicker
                  selectedType={selectedDrinkType}
                  onSelect={setSelectedDrinkType}
                  counts={localDrinkCounts}
                  disabled={isProcessing}
                  showLabels
                />

                {/* Stepper for selected drink type (local state) */}
                <LocalDrinkStepper
                  drinkType={selectedDrinkType}
                  count={localDrinkCounts[selectedDrinkType]}
                  onChange={handleLocalDrinkCountChange}
                  disabled={isProcessing}
                />

                {/* Total drinks - simple number */}
                <Text className="text-typography-500 text-center text-sm">
                  {t("attendance.totalDrinks")}: {totalLocalDrinks}
                </Text>
                {/* Validation error for drinks */}
                {errors.amount && (
                  <Text className="text-error-600 text-center text-sm">
                    {t(errors.amount.message || "validation.tent.required")}
                  </Text>
                )}
              </VStack>

              {/* Tent Selector */}
              <VStack space="sm">
                <Text className="text-typography-700 text-sm font-medium">
                  {t("attendance.table.visitedTents")}
                </Text>
                <Pressable
                  onPress={() => setShowTentSelector(true)}
                  className="border-background-300 bg-background-0 w-full rounded-lg border px-4 py-3"
                >
                  {combinedTentDisplay.length > 0 ? (
                    <HStack className="flex-wrap gap-2">
                      {combinedTentDisplay.map((tent) => (
                        <Badge
                          key={tent.id}
                          action="info"
                          variant="outline"
                          size="md"
                        >
                          <BadgeText className="normal-case">
                            {tent.checkInTime
                              ? `${tent.label} (${tent.checkInTime})`
                              : tent.label}
                          </BadgeText>
                        </Badge>
                      ))}
                    </HStack>
                  ) : (
                    <Text className="text-typography-400 text-base">
                      {t("attendance.form.selectTents")}
                    </Text>
                  )}
                </Pressable>
                {errors.tents && (
                  <Text className="text-error-600 text-sm">
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
                isUploading={isProcessing}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={showDeleteConfirm}
        onClose={handleCancelDelete}
        size="md"
      >
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="lg" className="text-error-600">
              {t("attendance.form.deleteConfirmTitle")}
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody className="mb-4 mt-3">
            <Text size="sm" className="text-typography-500">
              {t("attendance.form.deleteConfirmMessage")}
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-3">
            <Button
              variant="outline"
              action="secondary"
              onPress={handleCancelDelete}
              className="flex-1"
              isDisabled={isDeleting}
            >
              <ButtonText>{t("common.buttons.cancel")}</ButtonText>
            </Button>
            <Button
              action="negative"
              onPress={handleConfirmDelete}
              className="flex-1"
              isDisabled={isDeleting}
            >
              <ButtonText>
                {isDeleting
                  ? t("common.status.deleting")
                  : t("common.buttons.delete")}
              </ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

AttendanceFormSheet.displayName = "AttendanceFormSheet";
