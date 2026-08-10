import { zodResolver } from "@hookform/resolvers/zod";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AttendanceWithTotals, TentVisit } from "@prostcounter/shared/schemas";
import {
  createDetailedAttendanceFormSchema,
  type DetailedAttendanceForm,
  type DrinkType,
} from "@prostcounter/shared/schemas";
import { format, isToday, parseISO } from "date-fns";
import { Plus, Trash2 } from "lucide-react-native";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { TentAlreadyCurrentVisitError, useOfflineLogTentVisit } from "@/hooks/useOfflineAttendance";
import { useSaveAttendance } from "@/hooks/useSaveAttendance";
import { buildTentVisitRows, type TentVisitRow } from "@/lib/attendance/tent-visit-rows";
import { IconColors } from "@/lib/constants/colors";
import {
  useAdaptedAttendanceByDate,
  useAdaptedConsumptionsByDate,
  useAdaptedTents,
} from "@/lib/database/adapted-hooks";
import { useLocalDeleteAttendance } from "@/lib/database/hooks";
import { OfflineContext, triggerBackgroundPush } from "@/lib/database/offline-provider";
import { logger } from "@/lib/logger";

import { TentSelectorSheet } from "../../tent-selector/tent-selector-sheet";
import { BeerPicturesSection } from "../beer-pictures-section";
import { DrinkTypePicker } from "../drink-type-picker";
import { LocalDrinkStepper } from "../local-drink-stepper";

export interface AttendanceSuccessData {
  date: Date;
  tentIds: string[];
}

interface AttendanceTabContentProps {
  festivalId: string;
  festivalStartDate: Date;
  festivalEndDate: Date;
  selectedDate: Date;
  existingAttendance?: AttendanceWithTotals | null;
  onSuccess?: (data: AttendanceSuccessData) => void;
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
  const offlineContext = useContext(OfflineContext);
  const [showTentSelector, setShowTentSelector] = useState(false);
  const [showRevisitSelector, setShowRevisitSelector] = useState(false);
  const [revisitError, setRevisitError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<BeerPicture[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [photosMarkedForRemoval, setPhotosMarkedForRemoval] = useState<string[]>([]);
  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>("beer");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localDrinkCounts, setLocalDrinkCounts] = useState<Record<DrinkType, number>>({
    beer: 0,
    radler: 0,
    wine: 0,
    soft_drink: 0,
    alcohol_free: 0,
    other: 0,
  });

  const isEditMode = !!existingAttendance;
  const { tents } = useAdaptedTents(festivalId);
  const { saveAttendance, isSaving } = useSaveAttendance();
  const deleteAttendance = useLocalDeleteAttendance();
  const logTentVisit = useOfflineLogTentVisit();

  // Format date string for API calls
  const dateString =
    selectedDate && !isNaN(selectedDate.getTime()) ? format(selectedDate, "yyyy-MM-dd") : "";

  // Fetch consumptions for this date (local-first from SQLite)
  const { data: consumptionsData } = useAdaptedConsumptionsByDate(festivalId, dateString);
  const consumptions = useMemo(() => consumptionsData || [], [consumptionsData]);

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
    return Object.values(localDrinkCounts).reduce((sum, count) => sum + count, 0);
  }, [localDrinkCounts]);

  // Track initialization - keyed by date to handle date changes
  const hasInitializedRef = useRef(false);
  const lastDateRef = useRef<string | null>(null);
  const hasSeededTentsRef = useRef(false);

  // Fetch complete attendance data with beer pictures when editing (offline-first)
  const { data: attendanceWithPhotos } = useAdaptedAttendanceByDate(
    isEditMode ? festivalId : undefined,
    isEditMode ? dateString : undefined,
  );

  // Create dynamic schema based on festival dates
  const formSchema = useMemo(
    () => createDetailedAttendanceFormSchema(festivalStartDate, festivalEndDate),
    [festivalStartDate, festivalEndDate],
  );

  // Use fresh tent visits from API when available.
  // Memoized because several effects and memos below take it as a dependency; a
  // fresh array literal every render would re-run all of them every render.
  const freshTentVisits: TentVisit[] = useMemo(
    () => attendanceWithPhotos?.tentVisits ?? existingAttendance?.tentVisits ?? [],
    [attendanceWithPhotos?.tentVisits, existingAttendance?.tentVisits],
  );

  // Default values based on existing attendance
  const defaultValues = useMemo(() => {
    if (existingAttendance) {
      const uniqueTentIds: string[] = [
        ...new Set(freshTentVisits.map((tv: TentVisit) => tv.tentId)),
      ];
      return {
        amount: existingAttendance.drinkCount || existingAttendance.beerCount || 0,
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
  }, [existingAttendance, selectedDate, consumptions.length, freshTentVisits, prefillTentId]);

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
          amount: existingAttendance.drinkCount || existingAttendance.beerCount || 0,
          date: new Date(existingAttendance.date),
          tents: [...new Set(freshTentVisits.map((tv: TentVisit) => tv.tentId))],
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
    setRevisitError(null);
    hasInitializedRef.current = false;
    hasSeededTentsRef.current = false;
  }, [dateString, existingAttendance, freshTentVisits, prefillTentId, selectedDate, reset]);

  /*
   * Seed the tent field once the real tent visits arrive.
   *
   * The reset above runs before useAdaptedAttendanceByDate resolves, and the
   * list-derived `existingAttendance` always reports `tentVisits: []` (see
   * rowToAttendanceWithTotals), so the reset seeds an empty selection and its
   * own date guard then blocks every later run. Without this the field stays
   * empty for every day that already has tent visits.
   *
   * Seeds rather than resets so it cannot clobber a selection the user is in the
   * middle of editing, and runs at most once per date.
   */
  useEffect(() => {
    if (!isEditMode || hasSeededTentsRef.current || freshTentVisits.length === 0) {
      return;
    }
    hasSeededTentsRef.current = true;
    setValue("tents", [...new Set(freshTentVisits.map((tv: TentVisit) => tv.tentId))]);
  }, [freshTentVisits, isEditMode, setValue]);

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
        attendanceWithPhotos.pictures.map((pic: { id: string; pictureUrl: string }) => ({
          id: pic.id,
          pictureUrl: pic.pictureUrl,
        })),
      );
    }
  }, [attendanceWithPhotos]);

  // Keep form amount field in sync
  useEffect(() => {
    setValue("amount", totalLocalDrinks);
  }, [totalLocalDrinks, setValue]);

  // One badge per visit rather than per tent - see buildTentVisitRows for the rules.
  const combinedTentDisplay = useMemo((): TentVisitRow[] => {
    const allOptions = tents.flatMap((group) => group.options);
    return buildTentVisitRows({
      selectedTents,
      visits: freshTentVisits,
      labelFor: (tentId, fallback) =>
        allOptions.find((opt) => opt.value === tentId)?.label || fallback || "Unknown Tent",
      formatTime: (visitDate) => format(parseISO(visitDate), "HH:mm"),
    });
  }, [selectedTents, freshTentVisits, tents]);

  /*
   * When "log another visit" is offered.
   *
   * Needs a visit to revisit: with none yet there is nothing the tent selector
   * cannot already express, and the local guard has no day to read.
   *
   * Today only, because the visit is stamped with the current time. On a past day
   * that timestamp lands outside the day being edited, so the badge sorts after
   * every real visit and the server - which derives the visit's day from the
   * timestamp - files it under today instead. Backdating a visit to an invented
   * hour is a different feature; this one means "I just moved tents".
   */
  const canLogRevisit = freshTentVisits.length > 0 && isToday(selectedDate);

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

        onSuccess?.({ date: data.date, tentIds: data.tents });
        onClose();
      } catch (error) {
        logger.error("Failed to save attendance:", error);
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

  /*
   * Log one more visit to a tent.
   *
   * Immediate, unlike the rest of this form: it writes the visit and queues the
   * push straight away, because "I am in this tent now" is only true now.
   * Cancelling the form afterwards leaves the visit in place.
   *
   * Feedback is inline rather than a toast: this form lives inside an
   * actionsheet, and the overlay portal draws the sheet over the toast, so a
   * toast here is invisible and the rejection would look like a dead tap. On
   * success the new badge appearing with its time is the confirmation.
   */
  const handleLogRevisit = useCallback(
    async (tentId: string) => {
      if (!dateString) {
        return;
      }
      setRevisitError(null);

      try {
        await logTentVisit.mutateAsync({ festivalId, date: dateString, tentId });

        // Keep the form's tent set in step with the visit just written. Saving
        // reconciles the day to this set, so a tent missing from it would have its
        // brand-new visit deleted again.
        if (!selectedTents.includes(tentId)) {
          setValue("tents", [...selectedTents, tentId], { shouldValidate: true });
        }

        triggerBackgroundPush(offlineContext);
      } catch (error) {
        if (error instanceof TentAlreadyCurrentVisitError) {
          setRevisitError(t(`apiErrors.${ErrorCodes.TENT_ALREADY_CURRENT_VISIT}`));
          return;
        }
        logger.error("Failed to log tent visit:", error);
        setRevisitError(t("common.errors.generic"));
      }
    },
    [dateString, festivalId, logTentVisit, selectedTents, setValue, offlineContext, t],
  );

  const handleLocalDrinkCountChange = useCallback((drinkType: DrinkType, newCount: number) => {
    setLocalDrinkCounts((prev) => ({
      ...prev,
      [drinkType]: newCount,
    }));
  }, []);

  const handleTogglePhotoRemoval = useCallback((photoId: string) => {
    setPhotosMarkedForRemoval((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId],
    );
  }, []);

  const handleDeletePress = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!existingAttendance?.id) return;

    try {
      await deleteAttendance.mutateAsync({
        attendanceId: existingAttendance.id,
        festivalId,
      });
      setShowDeleteConfirm(false);
      onSuccess?.({ date: selectedDate, tentIds: [] });
      onClose();
    } catch (error) {
      logger.error("Failed to delete attendance:", error);
    }
  }, [existingAttendance?.id, deleteAttendance, festivalId, onSuccess, selectedDate, onClose]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  const isDeleting = deleteAttendance.isPending;
  const isLoggingVisit = logTentVisit.isPending;
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
              <ButtonText className="ml-2">{t("common.buttons.delete")}</ButtonText>
            </Button>
          </HStack>
        )}

        {/* Drink Type Picker & Stepper */}
        <VStack space="md">
          <Text className="text-center text-sm font-medium text-typography-700">
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

          <Text className="text-center text-sm text-typography-500">
            {t("attendance.totalDrinks")}: {totalLocalDrinks}
          </Text>
          {errors.amount && (
            <Text className="text-center text-sm text-error-600">
              {t(errors.amount.message || "validation.tent.required")}
            </Text>
          )}
        </VStack>

        {/* Tent Selector */}
        <VStack space="sm">
          <Text className="text-sm font-medium text-typography-700">
            {t("attendance.table.visitedTents")}
          </Text>
          <Pressable
            onPress={() => setShowTentSelector(true)}
            className="w-full rounded-lg border border-background-300 bg-background-0 px-4 py-3"
          >
            {combinedTentDisplay.length > 0 ? (
              <HStack className="flex-wrap gap-2">
                {combinedTentDisplay.map((visit) => (
                  <Badge key={visit.key} action="info" variant="outline" size="md">
                    <BadgeText className="normal-case">
                      {visit.checkInTime ? `${visit.label} (${visit.checkInTime})` : visit.label}
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
          {/* The selector above holds a set of tents, so it cannot say "this tent
              again, later". Only offered once the day has a visit: a first visit is
              what selecting a tent already means. */}
          {canLogRevisit && (
            <Button
              variant="outline"
              action="secondary"
              size="sm"
              className="self-start"
              onPress={() => setShowRevisitSelector(true)}
              isDisabled={isProcessing || isLoggingVisit}
              accessibilityLabel={t("attendance.form.logAnotherVisit")}
              accessibilityHint={t("attendance.form.logAnotherVisitHint")}
            >
              <Plus size={16} color={IconColors.default} />
              <ButtonText className="ml-2">{t("attendance.form.logAnotherVisit")}</ButtonText>
            </Button>
          )}
          {revisitError && <Text className="text-sm text-error-600">{revisitError}</Text>}
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
              {isSaving ? t("attendance.form.saving") : t("common.buttons.save")}
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

      {/* Revisit selector: single mode, so picking a tent closes it and logs at once */}
      <TentSelectorSheet
        isOpen={showRevisitSelector}
        onClose={() => setShowRevisitSelector(false)}
        festivalId={festivalId}
        mode="single"
        onSelectTent={handleLogRevisit}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog isOpen={showDeleteConfirm} onClose={handleCancelDelete} size="md">
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
                {isDeleting ? t("common.status.deleting") : t("common.buttons.delete")}
              </ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

AttendanceTabContent.displayName = "AttendanceTabContent";
