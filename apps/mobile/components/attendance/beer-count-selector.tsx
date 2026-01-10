import { useCallback } from "react";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

interface BeerCountSelectorProps {
  value: number;
  onChange: (count: number) => void;
  disabled?: boolean;
  maxCount?: number;
}

/**
 * Horizontal beer count selector (0-9)
 *
 * Displays a row of pressable buttons for quick beer count selection.
 * Selected value is highlighted with primary color.
 */
export function BeerCountSelector({
  value,
  onChange,
  disabled = false,
  maxCount = 9,
}: BeerCountSelectorProps) {
  const counts = Array.from({ length: maxCount + 1 }, (_, i) => i);

  const handlePress = useCallback(
    (count: number) => {
      if (!disabled) {
        onChange(count);
      }
    },
    [disabled, onChange]
  );

  return (
    <HStack className="flex-wrap justify-center gap-2">
      {counts.map((count) => {
        const isSelected = value === count;
        return (
          <Pressable
            key={count}
            onPress={() => handlePress(count)}
            disabled={disabled}
            className={`h-10 w-10 items-center justify-center rounded-full ${
              isSelected
                ? "bg-primary-500"
                : "bg-background-100"
            } ${disabled ? "opacity-50" : ""}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled }}
            accessibilityLabel={`${count} beers`}
          >
            <Text
              className={`text-base font-semibold ${
                isSelected ? "text-white" : "text-typography-700"
              }`}
            >
              {count}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
}

BeerCountSelector.displayName = "BeerCountSelector";
