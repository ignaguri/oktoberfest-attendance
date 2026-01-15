import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import * as Haptics from "expo-haptics";
import { Minus, Plus } from "lucide-react-native";
import { useCallback } from "react";

import type { DrinkType } from "@prostcounter/shared/schemas";

interface LocalDrinkStepperProps {
  drinkType: DrinkType;
  count: number;
  onChange: (drinkType: DrinkType, newCount: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

/**
 * Local drink stepper that manages state locally without API calls.
 * Use this in forms where you want to batch save changes.
 *
 * Features:
 * - Shows count for the specified drink type
 * - +/- buttons update local state via onChange callback
 * - Haptic feedback on tap
 * - Min/max constraints
 */
export function LocalDrinkStepper({
  drinkType,
  count,
  onChange,
  min = 0,
  max = 99,
  disabled = false,
}: LocalDrinkStepperProps) {
  const { t } = useTranslation();

  const canDecrement = count > min && !disabled;
  const canIncrement = count < max && !disabled;

  const handleDecrement = useCallback(() => {
    if (!canDecrement) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(drinkType, count - 1);
  }, [canDecrement, drinkType, count, onChange]);

  const handleIncrement = useCallback(() => {
    if (!canIncrement) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(drinkType, count + 1);
  }, [canIncrement, drinkType, count, onChange]);

  return (
    <HStack className="items-center justify-center gap-1.5">
      {/* Decrement button */}
      <Pressable
        onPress={handleDecrement}
        disabled={!canDecrement}
        className={cn(
          "h-10 w-10 items-center justify-center rounded-full border-2",
          canDecrement
            ? "border-primary-500 bg-primary-50 active:bg-primary-100"
            : "border-background-300 bg-background-100",
        )}
        accessibilityLabel={t("attendance.removeDrink")}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canDecrement }}
      >
        <Minus
          size={20}
          color={canDecrement ? IconColors.primary : IconColors.disabled}
        />
      </Pressable>

      {/* Count display */}
      <VStack className="min-w-[40px] items-center">
        <Text
          className={cn(
            "text-3xl font-bold",
            disabled ? "text-typography-400" : "text-typography-900",
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
          "h-10 w-10 items-center justify-center rounded-full border-2",
          canIncrement
            ? "border-primary-500 bg-primary-50 active:bg-primary-100"
            : "border-background-300 bg-background-100",
        )}
        accessibilityLabel={t("attendance.addDrink")}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canIncrement }}
      >
        <Plus
          size={20}
          color={canIncrement ? IconColors.primary : IconColors.disabled}
        />
      </Pressable>
    </HStack>
  );
}

LocalDrinkStepper.displayName = "LocalDrinkStepper";
