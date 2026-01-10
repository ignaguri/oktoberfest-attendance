import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Calendar } from "lucide-react-native";
import { format } from "date-fns";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import {
  createDetailedAttendanceFormSchema,
  type DetailedAttendanceForm,
} from "@prostcounter/shared/schemas";
import { useUpdatePersonalAttendance, useTents } from "@prostcounter/shared/hooks";

import { BeerStepper } from "./beer-stepper";
import { BeerPicturesSection } from "./beer-pictures-section";
import { TentSelectorSheet } from "../tent-selector/tent-selector-sheet";
import type { AttendanceData } from "./attendance-card";

interface AttendanceFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  festivalId: string;
  festivalStartDate: Date;
  festivalEndDate: Date;
  selectedDate: Date;
  existingAttendance?: AttendanceData | null;
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
 * - Photo upload section
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
  const [showTentSelector, setShowTentSelector] = useState(false);
  const [photos, setPhotos] = useState<BeerPicture[]>([]);

  const isEditMode = !!existingAttendance;
  const { tents } = useTents(festivalId);
  const updateAttendance = useUpdatePersonalAttendance();

  // Create dynamic schema based on festival dates
  const formSchema = useMemo(
    () => createDetailedAttendanceFormSchema(festivalStartDate, festivalEndDate),
    [festivalStartDate, festivalEndDate]
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
    formState: { errors, isSubmitting },
  } = useForm<DetailedAttendanceForm>({
    resolver: zodResolver(formSchema),
    values: defaultValues,
  });

  const selectedTents = watch("tents");

  // Reset form when opening/closing or date changes
  useEffect(() => {
    if (isOpen) {
      reset(defaultValues);
      setPhotos(existingAttendance?.beerPictures ?? []);
    }
  }, [isOpen, defaultValues, existingAttendance, reset]);

  // Update form date when selectedDate changes
  useEffect(() => {
    if (isOpen && !existingAttendance) {
      setValue("date", selectedDate);
    }
  }, [isOpen, selectedDate, existingAttendance, setValue]);

  // Get tent names for display
  const selectedTentNames = useMemo(() => {
    if (!selectedTents.length) return "";
    const allOptions = tents.flatMap((group) => group.options);
    const names = selectedTents
      .map((id) => allOptions.find((opt) => opt.value === id)?.label)
      .filter(Boolean);
    return names.length > 2
      ? `${names.slice(0, 2).join(", ")} +${names.length - 2}`
      : names.join(", ");
  }, [selectedTents, tents]);

  // Handle form submission
  const onSubmit = useCallback(
    async (data: DetailedAttendanceForm) => {
      try {
        await updateAttendance.mutateAsync({
          festivalId,
          // Use format() to avoid UTC timezone shift - toISOString() converts to UTC
          // which can cause the date to shift by a day depending on local timezone
          date: format(data.date, "yyyy-MM-dd"),
          amount: data.amount,
          tents: data.tents,
        });
        onSuccess?.();
        onClose();
      } catch (error) {
        console.error("Failed to save attendance:", error);
      }
    },
    [festivalId, updateAttendance, onSuccess, onClose]
  );

  const handleTentsSelect = useCallback(
    (tentIds: string[]) => {
      setValue("tents", tentIds, { shouldValidate: true });
    },
    [setValue]
  );

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
          <HStack className="w-full items-center justify-between px-2 mb-4">
            <Text className="text-lg font-semibold text-typography-900">
              {isEditMode ? "Edit Attendance" : "Add Attendance"}
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
                  Date
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
                <Text className="text-sm font-medium text-typography-700 text-center">
                  How many beers?
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
                  <Text className="text-sm text-error-600 text-center">
                    {errors.amount.message}
                  </Text>
                )}
              </VStack>

              {/* Tent Selector */}
              <VStack className="gap-2">
                <Text className="text-sm font-medium text-typography-700">
                  Tents Visited
                </Text>
                <Pressable
                  onPress={() => setShowTentSelector(true)}
                  className="w-full rounded-lg border border-background-300 bg-background-0 px-4 py-3"
                >
                  <Text
                    className={`text-base ${
                      selectedTents.length > 0
                        ? "text-typography-900"
                        : "text-typography-400"
                    }`}
                  >
                    {selectedTents.length > 0
                      ? selectedTentNames
                      : "Select tents..."}
                  </Text>
                </Pressable>
                {errors.tents && (
                  <Text className="text-sm text-error-600">
                    {errors.tents.message}
                  </Text>
                )}
              </VStack>

              {/* Beer Pictures Section */}
              <BeerPicturesSection
                attendanceId={existingAttendance?.id}
                existingPhotos={photos}
                onPhotosChange={setPhotos}
              />
            </VStack>
          </ActionsheetScrollView>

          {/* Footer Buttons */}
          <HStack className="w-full pt-3 gap-3 px-2">
            <Button
              variant="outline"
              action="secondary"
              className="flex-1"
              onPress={onClose}
              isDisabled={isSubmitting}
            >
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button
              variant="solid"
              action="primary"
              className="flex-1"
              onPress={handleSubmit(onSubmit)}
              isDisabled={isSubmitting}
            >
              <ButtonText>{isSubmitting ? "Saving..." : "Save"}</ButtonText>
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
