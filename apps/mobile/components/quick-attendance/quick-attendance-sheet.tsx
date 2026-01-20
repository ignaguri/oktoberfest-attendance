import { useFestival } from "@prostcounter/shared/contexts";
import {
  useAttendanceByDate,
  useConsumptions,
  useTents,
  useUpdatePersonalAttendance,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { DrinkType } from "@prostcounter/shared/schemas";
import { cn } from "@prostcounter/ui";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import {
  Beer,
  BeerOff,
  Camera,
  Check,
  ChevronDown,
  CupSoda,
  Minus,
  Wine,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RadlerIcon } from "@/components/icons/radler-icon";
import {
  type ImageSource,
  ImageSourcePicker,
} from "@/components/image-source-picker";
import { TentSelectorSheet } from "@/components/tent-selector/tent-selector-sheet";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "@/components/ui/actionsheet";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { VStack } from "@/components/ui/vstack";
import {
  type PendingPhoto,
  useBeerPictureUpload,
} from "@/hooks/useBeerPictureUpload";
import { useOfflineLogConsumption } from "@/hooks/useOfflineConsumption";
import {
  BackgroundColors,
  Colors,
  DrinkTypeColors,
  IconColors,
} from "@/lib/constants/colors";

interface QuickAttendanceSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Visible drink types for the quick attendance picker
 */
const DRINK_TYPES: DrinkType[] = [
  "beer",
  "radler",
  "alcohol_free",
  "wine",
  "soft_drink",
];

/**
 * Get the icon component for a drink type
 */
function DrinkIcon({
  type,
  size,
  color,
  backgroundColor,
}: {
  type: DrinkType;
  size: number;
  color: string;
  backgroundColor?: string;
}) {
  switch (type) {
    case "beer":
      return <Beer size={size} color={color} />;
    case "radler":
      return (
        <RadlerIcon
          size={size}
          color={color}
          backgroundColor={backgroundColor}
        />
      );
    case "wine":
      return <Wine size={size} color={color} />;
    case "soft_drink":
      return <CupSoda size={size} color={color} />;
    case "alcohol_free":
      return <BeerOff size={size} color={color} />;
    default:
      return <Beer size={size} color={color} />;
  }
}

/**
 * Get the color for a drink type
 */
function getDrinkColor(type: DrinkType): string {
  switch (type) {
    case "beer":
      return DrinkTypeColors.beer;
    case "radler":
      return DrinkTypeColors.radler;
    case "wine":
      return DrinkTypeColors.wine;
    case "soft_drink":
      return DrinkTypeColors.soft_drink;
    case "alcohol_free":
      return DrinkTypeColors.alcohol_free;
    default:
      return IconColors.default;
  }
}

/**
 * Quick Attendance ActionSheet for fast drink logging
 *
 * Features:
 * - Single row of drink type icons with count badges
 * - Single-selection toggle behavior (tap to select/deselect)
 * - Tent selector (preselects last selected tent)
 * - Photo upload section
 * - Save button to commit the +1 drink
 */
export function QuickAttendanceSheet({
  isOpen,
  onClose,
}: QuickAttendanceSheetProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { currentFestival } = useFestival();
  const festivalId = currentFestival?.id;

  // Get today's date
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  // Fetch today's attendance (for tent preselection)
  const { data: attendance, refetch: refetchAttendance } = useAttendanceByDate(
    festivalId || "",
    today,
  );

  // Fetch today's consumptions (for drink counts)
  const { data: consumptionsData } = useConsumptions(festivalId || "", today);

  // Fetch tents for name lookup
  const { tents: tentGroups } = useTents(festivalId);

  // Mutations
  const logConsumption = useOfflineLogConsumption();
  const updateAttendance = useUpdatePersonalAttendance();

  // Photo upload hook
  const {
    pickImages,
    uploadPendingPhotos,
    isPicking,
    isUploading: isUploadingPhotos,
  } = useBeerPictureUpload();

  // Local state
  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType | null>(
    null,
  );
  const [selectedTentId, setSelectedTentId] = useState<string | undefined>();
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [isTentSheetOpen, setIsTentSheetOpen] = useState(false);
  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate drink counts by type (original counts)
  const drinkCounts = useMemo(() => {
    const counts: Record<DrinkType, number> = {
      beer: 0,
      radler: 0,
      wine: 0,
      soft_drink: 0,
      alcohol_free: 0,
      other: 0,
    };
    const consumptions = consumptionsData || [];
    for (const c of consumptions) {
      if (counts[c.drinkType] !== undefined) {
        counts[c.drinkType]++;
      }
    }
    return counts;
  }, [consumptionsData]);

  // Get selected tent name for display
  const selectedTentName = useMemo(() => {
    if (!selectedTentId || !tentGroups) return null;
    for (const group of tentGroups) {
      const tent = group.options.find((t) => t.value === selectedTentId);
      if (tent) return tent.label;
    }
    return null;
  }, [selectedTentId, tentGroups]);

  // Get selected drink type label with plural support
  // Don't show +1 while saving to avoid double-counting after refetch
  const selectedDrinkLabel = useMemo(() => {
    if (!selectedDrinkType || isSaving) return null;
    const count = (drinkCounts[selectedDrinkType] || 0) + 1;
    const drinkName = t(`attendance.drinkTypes.${selectedDrinkType}`, {
      count,
    });
    return `${count} ${drinkName}`;
  }, [selectedDrinkType, drinkCounts, isSaving, t]);

  // Reset state when sheet opens, preselect tent from last attendance
  useEffect(() => {
    if (isOpen) {
      setSelectedDrinkType(null);
      setPendingPhotos([]);
      // Preselect tent from today's attendance
      const lastTentId = attendance?.tentIds?.[0];
      setSelectedTentId(lastTentId);
    }
  }, [isOpen, attendance?.tentIds]);

  // Handle drink type selection (toggle behavior)
  const handleDrinkTypeSelect = useCallback((type: DrinkType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDrinkType((prev) => (prev === type ? null : type));
  }, []);

  // Handle tent selection
  const handleTentSelect = useCallback((tentId: string) => {
    setSelectedTentId(tentId);
  }, []);

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

  // Handle save
  const handleSave = useCallback(async () => {
    if (!festivalId || !selectedDrinkType) return;

    setIsSaving(true);

    try {
      // Log the consumption
      // beerCost is in euros, we need cents
      const priceCents = currentFestival?.beerCost
        ? Math.round(currentFestival.beerCost * 100)
        : 1620; // Default €16.20

      await logConsumption.mutateAsync({
        festivalId,
        date: today,
        drinkType: selectedDrinkType,
        tentId: selectedTentId,
        pricePaidCents: priceCents,
        volumeMl: 1000,
      });

      // Update attendance with tent (API handles appending to tent visits)
      if (selectedTentId || pendingPhotos.length > 0) {
        const result = await updateAttendance.mutateAsync({
          festivalId,
          date: today,
          tents: selectedTentId ? [selectedTentId] : [],
        });

        // If we have pending photos, upload them
        if (pendingPhotos.length > 0) {
          const attendanceId = result?.attendance?.id || attendance?.id;
          if (attendanceId) {
            await uploadPendingPhotos({
              festivalId,
              attendanceId,
              pendingPhotos,
            });
          }
        }
      }

      // Refetch attendance data
      await refetchAttendance();

      // Show success toast
      toast.show({
        placement: "top",
        render: () => (
          <HStack className="bg-success-500 items-center gap-2 rounded-lg px-4 py-3">
            <Check size={18} color={Colors.white} />
            <Text className="font-medium text-white">
              {t("quickAttendance.drinkLogged", {
                defaultValue: "Drink logged!",
              })}
            </Text>
          </HStack>
        ),
      });

      // Close the sheet
      onClose();
    } catch {
      toast.show({
        placement: "top",
        render: () => (
          <HStack className="bg-error-500 items-center gap-2 rounded-lg px-4 py-3">
            <X size={18} color={Colors.white} />
            <Text className="font-medium text-white">
              {t("common.errors.generic")}
            </Text>
          </HStack>
        ),
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    festivalId,
    selectedDrinkType,
    selectedTentId,
    today,
    pendingPhotos,
    attendance?.id,
    currentFestival?.beerCost,
    logConsumption,
    updateAttendance,
    uploadPendingPhotos,
    refetchAttendance,
    toast,
    onClose,
    t,
  ]);

  const isLoading = isSaving || isUploadingPhotos;

  return (
    <>
      <Actionsheet isOpen={isOpen} onClose={onClose}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="pb-safe">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <VStack
            space="lg"
            className="w-full px-2"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            {/* Header */}
            <HStack className="items-center justify-between">
              <Text className="text-typography-900 text-lg font-semibold">
                {t("quickAttendance.sheetTitle", { defaultValue: "Quick Add" })}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={24} color={IconColors.default} />
              </Pressable>
            </HStack>

            {/* Drink Type Selector - Single Row */}
            <VStack space="sm" className="items-center">
              <HStack className="justify-center gap-3">
                {DRINK_TYPES.map((type) => {
                  const isSelected = selectedDrinkType === type;
                  const originalCount = drinkCounts[type] || 0;
                  // Show +1 count if selected (but not while saving, to avoid double-counting after refetch)
                  const displayCount =
                    isSelected && !isLoading
                      ? originalCount + 1
                      : originalCount;
                  const color = getDrinkColor(type);
                  const iconBgColor = isSelected
                    ? BackgroundColors[50]
                    : BackgroundColors[100];

                  return (
                    <Pressable
                      key={type}
                      onPress={() => handleDrinkTypeSelect(type)}
                      disabled={isLoading}
                      className="items-center"
                      accessibilityLabel={t(`attendance.drinkTypes.${type}`)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <VStack
                        className={cn(
                          "relative h-14 w-14 items-center justify-center rounded-xl border-2",
                          isSelected && "bg-background-50",
                          !isSelected && "border-background-200 bg-white",
                        )}
                        style={isSelected ? { borderColor: color } : undefined}
                      >
                        <DrinkIcon
                          type={type}
                          size={28}
                          color={isSelected ? color : IconColors.muted}
                          backgroundColor={iconBgColor}
                        />

                        {/* Count badge */}
                        {displayCount > 0 && (
                          <VStack
                            className="absolute -right-1 -top-1 min-w-[20px] items-center justify-center rounded-full px-1"
                            style={{ backgroundColor: color }}
                          >
                            <Text className="text-xs font-bold text-white">
                              {displayCount}
                            </Text>
                          </VStack>
                        )}
                      </VStack>
                    </Pressable>
                  );
                })}
              </HStack>

              {/* Selected drink type label */}
              {selectedDrinkLabel && (
                <Text
                  className="text-typography-700 text-center text-base font-medium"
                  style={{
                    color: selectedDrinkType
                      ? getDrinkColor(selectedDrinkType)
                      : undefined,
                  }}
                >
                  {selectedDrinkLabel}
                </Text>
              )}
            </VStack>

            {/* Tent Selector */}
            {festivalId && (
              <VStack space="xs">
                <Text className="text-typography-600 text-sm font-medium">
                  {t("home.quickAttendance.tent")}
                </Text>
                <Pressable
                  onPress={() => setIsTentSheetOpen(true)}
                  disabled={isLoading}
                  className={cn(
                    "flex-row items-center justify-between rounded-lg border px-4 py-3",
                    isLoading
                      ? "border-background-200 bg-background-100"
                      : "border-outline-200 active:bg-background-50 bg-white",
                  )}
                >
                  <Text
                    className={cn(
                      selectedTentName
                        ? "text-typography-900"
                        : "text-typography-400",
                    )}
                  >
                    {selectedTentName || t("home.quickAttendance.selectTent")}
                  </Text>
                  <ChevronDown
                    size={20}
                    color={isLoading ? IconColors.disabled : IconColors.muted}
                  />
                </Pressable>
              </VStack>
            )}

            {/* Photos Section */}
            <VStack space="xs">
              <Text className="text-typography-600 text-sm font-medium">
                {t("home.quickAttendance.photos")}
              </Text>
              <HStack className="flex-wrap gap-2">
                {/* Pending photos */}
                {pendingPhotos.map((photo) => (
                  <View key={photo.id} className="relative">
                    <Image
                      source={{ uri: photo.localUri }}
                      className={cn(
                        "h-16 w-16 rounded-lg",
                        isUploadingPhotos && "opacity-60",
                      )}
                      resizeMode="cover"
                      accessibilityLabel={t("home.quickAttendance.photos")}
                    />
                    {isUploadingPhotos ? (
                      <View className="absolute inset-0 items-center justify-center">
                        <ActivityIndicator
                          size="small"
                          color={IconColors.white}
                        />
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => handleRemovePendingPhoto(photo.id)}
                        className="bg-background-400 absolute -right-2 -top-2 h-5 w-5 items-center justify-center rounded-full"
                      >
                        <Minus size={12} color={IconColors.white} />
                      </Pressable>
                    )}
                  </View>
                ))}

                {/* Loading skeleton while picking */}
                {isPicking && (
                  <View className="bg-background-200 h-16 w-16 items-center justify-center rounded-lg">
                    <ActivityIndicator size="small" color={IconColors.muted} />
                  </View>
                )}

                {/* Add button */}
                {!isLoading && (
                  <Pressable
                    onPress={() => setIsSourcePickerOpen(true)}
                    disabled={isPicking}
                    className="border-background-300 bg-background-50 h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed"
                  >
                    <Camera size={20} color={IconColors.muted} />
                  </Pressable>
                )}
              </HStack>
            </VStack>

            {/* Save Button */}
            <Button
              variant="solid"
              action="primary"
              size="lg"
              onPress={handleSave}
              isDisabled={!selectedDrinkType || isLoading}
            >
              {isLoading && <ButtonSpinner color={Colors.white} />}
              <ButtonText>
                {isLoading
                  ? t("common.status.saving")
                  : t("quickAttendance.save", { defaultValue: "Save" })}
              </ButtonText>
            </Button>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>

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
    </>
  );
}

QuickAttendanceSheet.displayName = "QuickAttendanceSheet";
