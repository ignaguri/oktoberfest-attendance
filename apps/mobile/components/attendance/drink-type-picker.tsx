import { cn } from "@prostcounter/ui";
import { useTranslation } from "@prostcounter/shared/i18n";
import * as Haptics from "expo-haptics";
import { Beer, Wine, GlassWater, CupSoda } from "lucide-react-native";
import { useCallback } from "react";

import type { DrinkType } from "@prostcounter/shared/schemas";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DrinkTypeColors, IconColors } from "@/lib/constants/colors";

/**
 * Visible drink types for the picker (subset of all DrinkType values)
 */
export const VISIBLE_DRINK_TYPES: DrinkType[] = [
  "beer",
  "radler",
  "wine",
  "soft_drink",
];

interface DrinkTypePickerProps {
  selectedType: DrinkType;
  onSelect: (type: DrinkType) => void;
  counts?: Record<DrinkType, number>;
  disabled?: boolean;
  showLabels?: boolean;
  /** Compact mode for horizontal layouts (smaller icons, no labels) */
  compact?: boolean;
}

/**
 * Get the icon component for a drink type
 */
function DrinkIcon({
  type,
  size,
  color,
}: {
  type: DrinkType;
  size: number;
  color: string;
}) {
  switch (type) {
    case "beer":
    case "radler":
      return <Beer size={size} color={color} />;
    case "wine":
      return <Wine size={size} color={color} />;
    case "soft_drink":
      return <CupSoda size={size} color={color} />;
    case "alcohol_free":
      return <GlassWater size={size} color={color} />;
    default:
      return <GlassWater size={size} color={color} />;
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
    default:
      return IconColors.default;
  }
}

/**
 * Drink type picker with icon buttons and optional count badges
 *
 * Features:
 * - Horizontal row of drink type icons
 * - Selected state with color highlight
 * - Optional count badges
 * - Haptic feedback on selection
 */
export function DrinkTypePicker({
  selectedType,
  onSelect,
  counts = {} as Record<DrinkType, number>,
  disabled = false,
  showLabels = false,
  compact = false,
}: DrinkTypePickerProps) {
  const { t } = useTranslation();

  const handleSelect = useCallback(
    (type: DrinkType) => {
      if (!disabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect(type);
      }
    },
    [disabled, onSelect],
  );

  const getLabel = (type: DrinkType): string => {
    switch (type) {
      case "beer":
        return t("attendance.drinkTypes.beer");
      case "radler":
        return t("attendance.drinkTypes.radler");
      case "wine":
        return t("attendance.drinkTypes.wine");
      case "soft_drink":
        return t("attendance.drinkTypes.soft_drink");
      default:
        return type;
    }
  };

  // Size configuration based on compact mode
  const iconContainerSize = compact ? "h-10 w-10" : "h-14 w-14";
  const iconSize = compact ? 20 : 28;
  const badgeSize = compact ? "min-w-[16px]" : "min-w-[20px]";
  const badgeTextSize = compact ? "text-[10px]" : "text-xs";

  // Get border color based on selection
  const getBorderStyle = (type: DrinkType, isSelected: boolean) => {
    if (isSelected) {
      return { borderColor: getDrinkColor(type) };
    }
    return undefined;
  };

  return (
    <VStack space="xs" className="items-center justify-center">
      <HStack className="gap-2">
        {VISIBLE_DRINK_TYPES.map((type) => {
          const isSelected = selectedType === type;
          const count = counts[type] || 0;
          const color = getDrinkColor(type);

          return (
            <Pressable
              key={type}
              onPress={() => handleSelect(type)}
              disabled={disabled}
              className="items-center"
              accessibilityLabel={getLabel(type)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
            >
              <VStack space="xs" className="items-center">
                {/* Icon container */}
                <VStack
                  className={cn(
                    "relative items-center justify-center rounded-xl border-2",
                    iconContainerSize,
                    isSelected && "bg-background-50",
                    !isSelected && disabled && "border-background-200 bg-background-100",
                    !isSelected && !disabled && "border-background-200 bg-white"
                  )}
                  style={getBorderStyle(type, isSelected)}
                >
                  <DrinkIcon
                    type={type}
                    size={iconSize}
                    color={
                      isSelected
                        ? color
                        : disabled
                          ? IconColors.disabled
                          : IconColors.muted
                    }
                  />

                  {/* Count badge */}
                  {count > 0 && (
                    <VStack
                      className={cn(
                        "absolute -right-1 -top-1 items-center justify-center rounded-full px-1",
                        badgeSize
                      )}
                      style={{ backgroundColor: color }}
                    >
                      <Text className={cn(badgeTextSize, "font-bold text-white")}>
                        {count}
                      </Text>
                    </VStack>
                  )}
                </VStack>

                {/* Label - never show in compact mode */}
                {showLabels && !compact && (
                  <Text
                    className={cn(
                      "text-xs",
                      isSelected
                        ? "font-medium text-typography-900"
                        : "text-typography-500"
                    )}
                  >
                    {getLabel(type)}
                  </Text>
                )}
              </VStack>
            </Pressable>
          );
        })}
      </HStack>
      {/* Selected type label - show in compact mode */}
      {compact && (
        <Text className="text-xs font-medium text-typography-500">
          {getLabel(selectedType)}
        </Text>
      )}
    </VStack>
  );
}

DrinkTypePicker.displayName = "DrinkTypePicker";
