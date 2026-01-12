import { cn } from "@prostcounter/ui";

import { DrinkCountSummary } from "@/components/attendance/drink-count-summary";
import { DrinkTypePicker } from "@/components/attendance/drink-type-picker";
import { DrinkStepper } from "@/components/attendance/drink-stepper";
import {
  ImageSourcePicker,
  type ImageSource,
} from "@/components/image-source-picker";
import { ImagePreviewModal } from "@/components/shared/image-preview-modal";
import { TentSelectorSheet } from "@/components/tent-selector/tent-selector-sheet";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  useBeerPictureUpload,
  type PendingPhoto,
} from "@/hooks/useBeerPictureUpload";
import { Colors, IconColors } from "@/lib/constants/colors";
import { useFestival } from "@/lib/festival/FestivalContext";
import {
  useAttendanceByDate,
  useUpdatePersonalAttendance,
  useTents,
  useConsumptions,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { DrinkType } from "@prostcounter/shared/schemas";
import { format, isAfter, isBefore, parseISO, startOfDay } from "date-fns";
import { Beer, Camera, Check, ChevronDown, Minus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";

interface BeerPicture {
  id: string;
  pictureUrl: string;
}

/**
 * Quick attendance card for logging today's beer count, tent, and photos
 *
 * Features:
 * - Beer stepper (inline)
 * - Tent selector (opens sheet in single-select mode)
 * - Photo upload section with camera/gallery picker
 * - Auto-loads today's attendance on mount
 * - Save functionality with optimistic updates
 * - Disabled when outside festival dates
 */
export function QuickAttendanceCard() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const festivalId = currentFestival?.id;

  // Get today's date in YYYY-MM-DD format
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  // Check if we're within festival dates
  const isFestivalActive = useMemo(() => {
    if (!currentFestival?.startDate || !currentFestival?.endDate) {
      return false;
    }
    const now = startOfDay(new Date());
    const start = startOfDay(parseISO(currentFestival.startDate));
    const end = startOfDay(parseISO(currentFestival.endDate));
    return !isBefore(now, start) && !isAfter(now, end);
  }, [currentFestival?.startDate, currentFestival?.endDate]);

  // Fetch today's attendance
  const {
    data: attendance,
    loading: loadingAttendance,
    refetch: refetchAttendance,
  } = useAttendanceByDate(festivalId || "", today);

  // Fetch today's consumptions
  const { data: consumptionsData, loading: loadingConsumptions } =
    useConsumptions(festivalId || "", today);
  const consumptions = consumptionsData || [];

  // Fetch tents for the selector
  const { rawTents } = useTents(festivalId);

  // Mutations
  const updateAttendance = useUpdatePersonalAttendance();

  // Photo upload hook
  const {
    pickImages,
    uploadPendingPhotos,
    isPicking,
    isUploading: isUploadingPhotos,
  } = useBeerPictureUpload();

  // Local state
  const [selectedTentId, setSelectedTentId] = useState<string | undefined>();
  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>("beer");
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<BeerPicture[]>([]);
  const [isTentSheetOpen, setIsTentSheetOpen] = useState(false);
  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Calculate drink counts by type
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

  // Sync local state with fetched attendance
  useEffect(() => {
    if (attendance) {
      // Use first tent from the list if any
      const firstTentId = attendance.tentIds?.[0];
      setSelectedTentId(firstTentId);
      // Set existing photos
      setExistingPhotos(
        (attendance.pictures || []).map((p: any) => ({
          id: p.id,
          pictureUrl: p.pictureUrl,
        })),
      );
    }
  }, [attendance]);

  // Get tent name for display
  const selectedTentName = useMemo(() => {
    if (!selectedTentId || !rawTents.length) return null;
    const festivalTent = rawTents.find((ft: any) => {
      const tent = ft.tent || ft;
      return tent.id === selectedTentId;
    });
    const tent = festivalTent?.tent || festivalTent;
    return tent?.name || null;
  }, [selectedTentId, rawTents]);

  // Handle image source selection
  const handleSourceSelect = useCallback(
    async (source: ImageSource) => {
      const newPhotos = await pickImages(source);
      if (newPhotos?.length) {
        setPendingPhotos((prev) => [...prev, ...newPhotos]);
      }
    },
    [pickImages],
  );

  // Handle remove pending photo
  const handleRemovePendingPhoto = useCallback((photoId: string) => {
    setPendingPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }, []);

  // Handle image preview
  const handleImagePreview = useCallback((imageUri: string) => {
    setPreviewImage(imageUri);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  // Auto-save tent selection
  const autoSaveTent = useCallback(
    async (newTentId: string | undefined) => {
      if (!festivalId || isAutoSaving) return;

      setIsAutoSaving(true);

      try {
        await updateAttendance.mutateAsync({
          festivalId,
          date: today,
          tents: newTentId ? [newTentId] : [],
        });

        // Success feedback (visible for 3 seconds)
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (error) {
        console.error("Failed to auto-save attendance:", error);
      } finally {
        setIsAutoSaving(false);
      }
    },
    [festivalId, today, updateAttendance, isAutoSaving],
  );

  // Handle tent selection - auto-saves
  const handleTentSelect = useCallback(
    (tentId: string | undefined) => {
      setSelectedTentId(tentId);
      autoSaveTent(tentId);
    },
    [autoSaveTent],
  );

  // Handle quick add success (shows success feedback)
  const handleQuickAddSuccess = useCallback(() => {
    // The QuickAddDrinkButtons component handles its own success animation,
    // but we can trigger a refetch here if needed
    refetchAttendance();
  }, [refetchAttendance]);

  // Handle photo upload save (only for pending photos)
  const handleUploadPhotos = useCallback(async () => {
    if (!festivalId || pendingPhotos.length === 0) return;

    setIsAutoSaving(true);

    try {
      // First ensure we have an attendance record
      const result = await updateAttendance.mutateAsync({
        festivalId,
        date: today,
        tents: selectedTentId ? [selectedTentId] : [],
      });

      // Upload pending photos
      const attendanceId = result?.attendance?.id || attendance?.id;
      if (attendanceId) {
        await uploadPendingPhotos({
          festivalId,
          attendanceId,
          pendingPhotos,
        });
        setPendingPhotos([]);
      }

      // Refetch to get updated photos
      await refetchAttendance();

      // Success feedback (visible for 3 seconds)
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to upload photos:", error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [
    festivalId,
    today,
    selectedTentId,
    pendingPhotos,
    attendance?.id,
    updateAttendance,
    uploadPendingPhotos,
    refetchAttendance,
  ]);

  // Check if there are pending photos to upload
  const hasPendingPhotos = pendingPhotos.length > 0;

  // Loading state
  if ((loadingAttendance || loadingConsumptions) && !attendance) {
    return (
      <Card variant="outline" size="md" className="bg-white">
        <VStack space="md" className="items-center py-6">
          <ActivityIndicator size="small" color={Colors.primary[500]} />
          <Text className="text-typography-500">
            {t("home.quickAttendance.loading", {
              defaultValue: "Loading attendance...",
            })}
          </Text>
        </VStack>
      </Card>
    );
  }

  // Disabled state (outside festival dates)
  if (!isFestivalActive) {
    return (
      <Card variant="outline" size="md" className="bg-white">
        <VStack space="md">
          <HStack space="sm" className="items-center">
            <Beer size={20} color={IconColors.disabled} />
            <Heading size="sm" className="text-typography-500">
              {t("home.quickAttendance.title", {
                defaultValue: "Log Today's Beer",
              })}
            </Heading>
          </HStack>
          <Text className="text-center text-typography-400">
            {t("home.quickAttendance.outsideFestival", {
              defaultValue:
                "Attendance logging is only available during the festival",
            })}
          </Text>
        </VStack>
      </Card>
    );
  }

  const isLoading = isAutoSaving || isUploadingPhotos;

  return (
    <Card variant="outline" size="md" className="bg-white">
      <VStack space="lg">
        {/* Header with drink count summary */}
        <HStack className="items-center justify-between">
          <HStack space="sm" className="items-center">
            <Beer size={20} color={IconColors.primary} />
            <Heading size="sm" className="text-typography-900">
              {t("home.quickAttendance.title", {
                defaultValue: "Quick Add",
              })}
            </Heading>
          </HStack>
          {consumptions.length > 0 && (
            <DrinkCountSummary consumptions={consumptions} compact showTotal={false} />
          )}
        </HStack>

        {/* Drink Type Selector + Stepper (horizontal layout) */}
        {festivalId && (
          <HStack className="items-start justify-between">
            {/* Drink Type Picker on the left */}
            <DrinkTypePicker
              selectedType={selectedDrinkType}
              onSelect={setSelectedDrinkType}
              counts={drinkCounts}
              disabled={isLoading}
              compact
            />

            {/* Stepper on the right - add top padding to align with icons */}
            <VStack className="items-center pt-0.5">
              <DrinkStepper
                festivalId={festivalId}
                date={today}
                drinkType={selectedDrinkType}
                tentId={selectedTentId}
                consumptions={consumptions}
                disabled={isLoading}
                onMutationEnd={handleQuickAddSuccess}
              />
            </VStack>
          </HStack>
        )}

        {/* Tent Selector */}
        <VStack space="xs">
          <Text className="text-sm font-medium text-typography-600">
            {t("home.quickAttendance.tent", { defaultValue: "Tent" })}
          </Text>
          <Pressable
            onPress={() => setIsTentSheetOpen(true)}
            disabled={isLoading}
            className={cn(
              "flex-row items-center justify-between rounded-lg border px-4 py-3",
              isLoading
                ? "border-background-200 bg-background-100"
                : "border-outline-200 bg-white active:bg-background-50"
            )}
          >
            <Text
              className={cn(
                selectedTentName ? "text-typography-900" : "text-typography-400"
              )}
            >
              {selectedTentName ||
                t("home.quickAttendance.selectTent", {
                  defaultValue: "Select a tent",
                })}
            </Text>
            <ChevronDown
              size={20}
              color={isLoading ? IconColors.disabled : IconColors.muted}
            />
          </Pressable>
        </VStack>

        {/* Photos Section */}
        <VStack space="xs">
          <Text className="text-sm font-medium text-typography-600">
            {t("home.quickAttendance.photos", { defaultValue: "Photos" })}
          </Text>
          <HStack className="flex-wrap gap-2">
            {/* Existing photos */}
            {existingPhotos.map((photo) => (
              <Pressable
                key={photo.id}
                onPress={() => handleImagePreview(photo.pictureUrl)}
                className="relative"
              >
                <Image
                  source={{ uri: photo.pictureUrl }}
                  className="h-16 w-16 rounded-lg"
                  resizeMode="cover"
                  accessibilityLabel={t("home.quickAttendance.beerPhoto", {
                    defaultValue: "Beer photo",
                  })}
                />
              </Pressable>
            ))}

            {/* Pending photos */}
            {pendingPhotos.map((photo) => (
              <View key={photo.id} className="relative">
                <Pressable onPress={() => handleImagePreview(photo.localUri)}>
                  <Image
                    source={{ uri: photo.localUri }}
                    className={cn(
                      "h-16 w-16 rounded-lg",
                      isUploadingPhotos && "opacity-60"
                    )}
                    resizeMode="cover"
                    accessibilityLabel={t("home.quickAttendance.pendingPhoto", {
                      defaultValue: "Pending photo upload",
                    })}
                  />
                </Pressable>
                {isUploadingPhotos ? (
                  <View className="absolute inset-0 items-center justify-center">
                    <ActivityIndicator size="small" color={IconColors.white} />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => handleRemovePendingPhoto(photo.id)}
                    className="absolute -right-2 -top-2 h-5 w-5 items-center justify-center rounded-full bg-background-400"
                  >
                    <Minus size={12} color={IconColors.white} />
                  </Pressable>
                )}
              </View>
            ))}

            {/* Loading skeleton while picking */}
            {isPicking && (
              <View className="h-16 w-16 items-center justify-center rounded-lg bg-background-200">
                <ActivityIndicator size="small" color={IconColors.muted} />
              </View>
            )}

            {/* Add button */}
            {!isLoading && (
              <Pressable
                onPress={() => setIsSourcePickerOpen(true)}
                disabled={isPicking}
                className="h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-background-300 bg-background-50"
              >
                <Camera size={20} color={IconColors.muted} />
              </Pressable>
            )}
          </HStack>
        </VStack>

        {/* Auto-save indicator or Upload Photos button */}
        {isAutoSaving ? (
          <HStack space="sm" className="items-center justify-center py-2">
            <ActivityIndicator size="small" color={Colors.primary[500]} />
            <Text className="text-sm text-typography-500">
              {t("common.status.saving", { defaultValue: "Saving..." })}
            </Text>
          </HStack>
        ) : saveSuccess ? (
          <HStack space="sm" className="items-center justify-center py-2">
            <Check size={18} color={Colors.success[500]} />
            <Text className="text-sm text-success-600">
              {t("common.status.saved", { defaultValue: "Saved!" })}
            </Text>
          </HStack>
        ) : hasPendingPhotos ? (
          <Button
            variant="solid"
            action="primary"
            size="md"
            onPress={handleUploadPhotos}
            disabled={isUploadingPhotos}
          >
            {isUploadingPhotos && <ButtonSpinner color={Colors.white} />}
            <ButtonText>
              {isUploadingPhotos
                ? t("home.quickAttendance.uploadingPhotos", {
                    defaultValue: "Uploading photos...",
                  })
                : t("home.quickAttendance.uploadPhotos", {
                    defaultValue: "Upload Photos",
                  })}
            </ButtonText>
          </Button>
        ) : null}
      </VStack>

      {/* Tent Selector Sheet */}
      {festivalId && (
        <TentSelectorSheet
          isOpen={isTentSheetOpen}
          onClose={() => setIsTentSheetOpen(false)}
          festivalId={festivalId}
          mode="single"
          selectedTent={selectedTentId}
          onSelectTent={handleTentSelect}
        />
      )}

      {/* Image Source Picker */}
      <ImageSourcePicker
        isOpen={isSourcePickerOpen}
        onClose={() => setIsSourcePickerOpen(false)}
        onSelect={handleSourceSelect}
        disabled={isPicking}
      />

      {/* Image Preview Modal */}
      <ImagePreviewModal imageUri={previewImage} onClose={handleClosePreview} />
    </Card>
  );
}

QuickAttendanceCard.displayName = "QuickAttendanceCard";
