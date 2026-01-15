import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import {
  useLogConsumption,
  useDeleteConsumption,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import * as Haptics from "expo-haptics";
import { Minus, Plus } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { ActivityIndicator } from "react-native";

import type { DrinkType, Consumption } from "@prostcounter/shared/schemas";

interface DrinkStepperProps {
  festivalId: string;
  date: string;
  drinkType: DrinkType;
  tentId?: string;
  consumptions: Consumption[];
  defaultPriceCents?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onMutationStart?: () => void;
  onMutationEnd?: () => void;
}

/**
 * Enhanced drink stepper that creates/deletes consumptions via API
 *
 * Features:
 * - Shows count for the specified drink type
 * - + button creates a new consumption via useLogConsumption
 * - - button deletes the most recent consumption of that type
 * - Loading states during API calls
 * - Haptic feedback on tap
 * - Min/max constraints
 */
export function DrinkStepper({
  festivalId,
  date,
  drinkType,
  tentId,
  consumptions,
  defaultPriceCents = 1620, // Default €16.20
  min = 0,
  max = 99,
  disabled = false,
  onMutationStart,
  onMutationEnd,
}: DrinkStepperProps) {
  const { t } = useTranslation();
  const logConsumption = useLogConsumption();
  const deleteConsumption = useDeleteConsumption();

  // Filter consumptions by drink type and calculate count
  const typeConsumptions = useMemo(() => {
    return consumptions.filter((c) => c.drinkType === drinkType);
  }, [consumptions, drinkType]);

  const count = typeConsumptions.length;

  // Get the most recent consumption of this type (for deletion)
  const mostRecentConsumption = useMemo(() => {
    if (typeConsumptions.length === 0) return null;
    return typeConsumptions.reduce((latest, current) => {
      return new Date(current.recordedAt) > new Date(latest.recordedAt)
        ? current
        : latest;
    });
  }, [typeConsumptions]);

  const isLoading = logConsumption.loading || deleteConsumption.loading;
  const canDecrement = count > min && !disabled && !isLoading;
  const canIncrement = count < max && !disabled && !isLoading;

  const handleDecrement = useCallback(async () => {
    if (!canDecrement || !mostRecentConsumption) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onMutationStart?.();

    try {
      await deleteConsumption.mutateAsync(mostRecentConsumption.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Failed to delete consumption:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      onMutationEnd?.();
    }
  }, [
    canDecrement,
    mostRecentConsumption,
    deleteConsumption,
    onMutationStart,
    onMutationEnd,
  ]);

  const handleIncrement = useCallback(async () => {
    if (!canIncrement) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onMutationStart?.();

    try {
      await logConsumption.mutateAsync({
        festivalId,
        date,
        drinkType,
        tentId,
        pricePaidCents: defaultPriceCents,
        volumeMl: 1000, // Default 1L
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Failed to log consumption:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      onMutationEnd?.();
    }
  }, [
    canIncrement,
    festivalId,
    date,
    drinkType,
    tentId,
    defaultPriceCents,
    logConsumption,
    onMutationStart,
    onMutationEnd,
  ]);

  return (
    <HStack className="items-center justify-center gap-2">
      {/* Decrement button */}
      <Pressable
        onPress={handleDecrement}
        disabled={!canDecrement}
        className={cn(
          "h-14 w-14 items-center justify-center rounded-full border-2",
          canDecrement
            ? "border-primary-500 bg-primary-50 active:bg-primary-100"
            : "border-background-300 bg-background-100",
        )}
        accessibilityLabel={t("attendance.removeDrink")}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canDecrement }}
      >
        {deleteConsumption.loading ? (
          <ActivityIndicator size="small" color={IconColors.primary} />
        ) : (
          <Minus
            size={28}
            color={canDecrement ? IconColors.primary : IconColors.disabled}
          />
        )}
      </Pressable>

      {/* Count display */}
      <VStack className="min-w-[50px] items-center">
        <Text
          className={cn(
            "text-4xl font-bold",
            disabled || isLoading
              ? "text-typography-400"
              : "text-typography-900",
          )}
        >
          {count}
        </Text>
      </VStack>

      {/* Increment button */}
      <Pressable
        onPress={handleIncrement}
        disabled={!canIncrement}
        className={cn(
          "h-14 w-14 items-center justify-center rounded-full border-2",
          canIncrement
            ? "border-primary-500 bg-primary-50 active:bg-primary-100"
            : "border-background-300 bg-background-100",
        )}
        accessibilityLabel={t("attendance.addDrink")}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canIncrement }}
      >
        {logConsumption.loading ? (
          <ActivityIndicator size="small" color={IconColors.primary} />
        ) : (
          <Plus
            size={28}
            color={canIncrement ? IconColors.primary : IconColors.disabled}
          />
        )}
      </Pressable>
    </HStack>
  );
}

DrinkStepper.displayName = "DrinkStepper";
