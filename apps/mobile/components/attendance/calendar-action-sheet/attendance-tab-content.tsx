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
import { Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

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

import { TentSelectorSheet } from "../../tent-selector/tent-selector-sheet";
import { BeerPicturesSection } from "../beer-pictures-section";
import { DrinkTypePicker } from "../drink-type-picker";
import { LocalDrinkStepper } from "../local-drink-stepper";

interface AttendanceTabContentProps {
  festivalId: string;
  festivalStartDate: Date;
  festivalEndDate: Date;
  selectedDate: Date;
  existingAttendance?: AttendanceWithTotals | null;
  onSuccess?: () => void;
  onClose: () => void;
  prefillTentId?: string;
}

interface BeerPicture {
  id: string;
  pictureUrl: string;
}

/**
 * Attendance form tab content
 *
 * Extracted from AttendanceFormSheet for use in CalendarActionSheet tabs.
 * Contains all drink counting, tent selection, and photo upload functionality.
 */
export function AttendanceTabContent({
  festivalId,
  festivalStartDate,
  festivalEndDate,
  selectedDate,
  existingAttendance,
  onSuccess,
  onClose,
  prefillTentId,
}: AttendanceTabContentProps) {
  const { t } = useTranslation();
  const [showTentSelector, setShowTentSelector] = useState(false);
  const [photos, setPhotos] = useState<BeerPicture[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [photosMarkedForRemoval, setPhotosMarkedForRemoval] = useState<
    string[]
  >([]);
  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>("beer");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
  const { data: consumptionsData } = useConsumptions(festivalId, dateString);
  const consumptions = consumptionsData || [];

  // Calculate counts per drink type from API consumptions
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

  // Track initialization - keyed by date to handle date changes
  const hasInitializedRef = useRef(false);
  const lastDateRef = useRef<string | null>(null);

  // Fetch complete attendance data with beer pictures when editing
  const { data: attendanceWithPhotos } = useAttendanceByDate(
    isEditMode ? festivalId : "",
    isEditMode ? dateString : "",
  );

  // Create dynamic schema based on festival dates
  const formSchema = useMemo(
    () =>
      createDetailedAttendanceFormSchema(festivalStartDate, festivalEndDate),
    [festivalStartDate, festivalEndDate],
  );

  // Use fresh tent visits from API when available
  const freshTentVisits: TentVisit[] =
    attendanceWithPhotos?.tentVisits ?? existingAttendance?.tentVisits ?? [];

  // Default values based on existing attendance
  const defaultValues = useMemo(() => {
    if (existingAttendance) {
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
    // For new attendance, pre-fill tent if provided (from check-in)
    return {
      amount: consumptions.length,
      date: selectedDate,
      tents: prefillTentId ? [prefillTentId] : ([] as string[]),
    };
  }, [
    existingAttendance,
    selectedDate,
    consumptions.length,
    freshTentVisits,
    prefillTentId,
  ]);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DetailedAttendanceForm>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const selectedTents = watch("tents");

  // Initialize form when date changes (not when defaultValues changes to avoid infinite loop)
  useEffect(() => {
    // Only reset when the date actually changes
    if (lastDateRef.current === dateString) {
      return;
    }
    lastDateRef.current = dateString;

    // Calculate initial values for the new date
    const initialValues = existingAttendance
      ? {
          amount:
            existingAttendance.drinkCount || existingAttendance.beerCount || 0,
          date: new Date(existingAttendance.date),
          tents: [
            ...new Set(freshTentVisits.map((tv: TentVisit) => tv.tentId)),
          ],
        }
      : {
          amount: 0,
          date: selectedDate,
          tents: prefillTentId ? [prefillTentId] : ([] as string[]),
        };

    reset(initialValues);
    setPhotos([]);
    setPendingPhotos([]);
    setPhotosMarkedForRemoval([]);
    setLocalDrinkCounts({
      beer: 0,
      radler: 0,
      wine: 0,
      soft_drink: 0,
      alcohol_free: 0,
      other: 0,
    });
    setSelectedDrinkType("beer");
    hasInitializedRef.current = false;
  }, [
    dateString,
    existingAttendance,
    freshTentVisits,
    prefillTentId,
    selectedDate,
    reset,
  ]);

  // Initialize local drink counts when consumptions are loaded
  useEffect(() => {
    if (!hasInitializedRef.current && consumptions.length > 0) {
      setLocalDrinkCounts(drinkCounts);
      hasInitializedRef.current = true;
    }
  }, [consumptions.length, drinkCounts]);

  // Load photos from API when attendance data is fetched
  useEffect(() => {
    if (attendanceWithPhotos?.pictures?.length) {
      setPhotos(
        attendanceWithPhotos.pictures.map(
          (pic: { id: string; pictureUrl: string }) => ({
            id: pic.id,
            pictureUrl: pic.pictureUrl,
          }),
        ),
      );
    }
  }, [attendanceWithPhotos]);

  // Keep form amount field in sync
  useEffect(() => {
    setValue("amount", totalLocalDrinks);
  }, [totalLocalDrinks, setValue]);

  // Combined tent display with timestamps
  const combinedTentDisplay = useMemo(() => {
    const allOptions = tents.flatMap((group) => group.options);

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

    return selectedTents.map((tentId) => {
      const option = allOptions.find((opt) => opt.value === tentId);
      const label = option?.label || "Unknown Tent";
      const visitInfo = latestVisitByTent.get(tentId);

      return {
        id: tentId,
        label,
        checkInTime: visitInfo?.checkInTime || null,
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
          amount: totalLocalDrinks,
          tents: data.tents,
          existingAttendanceId: existingAttendance?.id,
          pendingPhotos,
          photosToDelete: photosMarkedForRemoval,
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

  const handleLocalDrinkCountChange = useCallback(
    (drinkType: DrinkType, newCount: number) => {
      setLocalDrinkCounts((prev) => ({
        ...prev,
        [drinkType]: newCount,
      }));
    },
    [],
  );

  const handleTogglePhotoRemoval = useCallback((photoId: string) => {
    setPhotosMarkedForRemoval((prev) =>
      prev.includes(photoId)
        ? prev.filter((id) => id !== photoId)
        : [...prev, photoId],
    );
  }, []);

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

  return (
    <>
      <VStack space="xl" className="px-2 pb-4">
        {/* Delete Button - Only in edit mode */}
        {isEditMode && (
          <HStack className="justify-end">
            <Button
              variant="outline"
              action="negative"
              size="sm"
              onPress={handleDeletePress}
              isDisabled={isProcessing}
            >
              <Trash2 size={16} color={IconColors.error} />
              <ButtonText className="ml-2">
                {t("common.buttons.delete")}
              </ButtonText>
            </Button>
          </HStack>
        )}

        {/* Drink Type Picker & Stepper */}
        <VStack space="md">
          <Text className="text-typography-700 text-center text-sm font-medium">
            {t("attendance.howManyDrinks")}
          </Text>

          <DrinkTypePicker
            selectedType={selectedDrinkType}
            onSelect={setSelectedDrinkType}
            counts={localDrinkCounts}
            disabled={isProcessing}
            showLabels
          />

          <LocalDrinkStepper
            drinkType={selectedDrinkType}
            count={localDrinkCounts[selectedDrinkType]}
            onChange={handleLocalDrinkCountChange}
            disabled={isProcessing}
          />

          <Text className="text-typography-500 text-center text-sm">
            {t("attendance.totalDrinks")}: {totalLocalDrinks}
          </Text>
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
            isDisabled={isProcessing}
          >
            <ButtonText>
              {isSaving
                ? t("attendance.form.saving")
                : t("common.buttons.save")}
            </ButtonText>
          </Button>
        </HStack>
      </VStack>

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

AttendanceTabContent.displayName = "AttendanceTabContent";
