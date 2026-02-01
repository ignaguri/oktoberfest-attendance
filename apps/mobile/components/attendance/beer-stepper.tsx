import { cn } from "@prostcounter/ui";
import * as Haptics from "expo-haptics";
import { Minus, Plus } from "lucide-react-native";
import { useCallback } from "react";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { IconColors } from "@/lib/constants/colors";

interface BeerStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

/**
 * Beer count stepper with - / count / + buttons
 *
 * Features:
 * - Increment/decrement buttons
 * - Haptic feedback on tap
 * - Min/max constraints
 * - Disabled state
 */
export function BeerStepper({
  value,
  onChange,
  min = 0,
  max = 20,
  disabled = false,
}: BeerStepperProps) {
  const handleDecrement = useCallback(() => {
    if (value > min && !disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(value - 1);
    }
  }, [value, min, disabled, onChange]);

  const handleIncrement = useCallback(() => {
    if (value < max && !disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(value + 1);
    }
  }, [value, max, disabled, onChange]);

  const canDecrement = value > min && !disabled;
  const canIncrement = value < max && !disabled;

  return (
    <HStack className="items-center justify-center gap-4">
      {/* Decrement button */}
      <Pressable
        onPress={handleDecrement}
        disabled={!canDecrement}
        className={cn(
          "h-12 w-12 items-center justify-center rounded-full border-2",
          canDecrement
            ? "border-primary-500 bg-primary-50 active:bg-primary-100"
            : "border-background-300 bg-background-100",
        )}
      >
        <Minus
          size={24}
          color={canDecrement ? IconColors.primary : IconColors.disabled}
        />
      </Pressable>

      {/* Count display */}
      <Text
        className={cn(
          "min-w-[60px] text-center text-4xl font-bold",
          disabled ? "text-typography-400" : "text-typography-900",
        )}
      >
        {value}
      </Text>

      {/* Increment button */}
      <Pressable
        onPress={handleIncrement}
        disabled={!canIncrement}
        className={cn(
          "h-12 w-12 items-center justify-center rounded-full border-2",
          canIncrement
            ? "border-primary-500 bg-primary-50 active:bg-primary-100"
            : "border-background-300 bg-background-100",
        )}
      >
        <Plus
          size={24}
          color={canIncrement ? IconColors.primary : IconColors.disabled}
        />
      </Pressable>
    </HStack>
  );
}

BeerStepper.displayName = "BeerStepper";
