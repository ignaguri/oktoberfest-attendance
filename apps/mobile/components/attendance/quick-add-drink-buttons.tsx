import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DrinkTypeColors, IconColors, Colors } from "@/lib/constants/colors";
import { useLogConsumption } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import * as Haptics from "expo-haptics";
import { Beer, Wine, CupSoda, Check } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator } from "react-native";

import type { DrinkType } from "@prostcounter/shared/schemas";

import { VISIBLE_DRINK_TYPES } from "./drink-type-picker";

interface QuickAddDrinkButtonsProps {
  festivalId: string;
  date: string;
  tentId?: string;
  defaultPriceCents?: number;
  disabled?: boolean;
  onSuccess?: () => void;
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
    default:
      return IconColors.default;
  }
}

/**
 * Quick +1 buttons for each drink type
 *
 * Features:
 * - One button per drink type
 * - Each tap logs a consumption directly
 * - Success animation (checkmark) after tap
 * - Haptic feedback
 */
export function QuickAddDrinkButtons({
  festivalId,
  date,
  tentId,
  defaultPriceCents = 1620,
  disabled = false,
  onSuccess,
}: QuickAddDrinkButtonsProps) {
  const { t } = useTranslation();
  const logConsumption = useLogConsumption();
  const [successType, setSuccessType] = useState<DrinkType | null>(null);
  const [loadingType, setLoadingType] = useState<DrinkType | null>(null);

  const getLabel = (type: DrinkType): string => {
    switch (type) {
      case "beer":
        return t("home.quickAdd.beer");
      case "radler":
        return t("home.quickAdd.radler");
      case "wine":
        return t("home.quickAdd.wine");
      case "soft_drink":
        return t("home.quickAdd.soft");
      default:
        return `+1 ${type}`;
    }
  };

  const handleQuickAdd = useCallback(
    async (type: DrinkType) => {
      if (disabled || loadingType) return;

      setLoadingType(type);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        await logConsumption.mutateAsync({
          festivalId,
          date,
          drinkType: type,
          tentId,
          pricePaidCents: defaultPriceCents,
          volumeMl: 1000, // Default 1L
        });

        // Show success animation
        setSuccessType(type);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess?.();

        // Clear success after animation
        setTimeout(() => setSuccessType(null), 1500);
      } catch (error) {
        console.error("Failed to log consumption:", error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setLoadingType(null);
      }
    },
    [
      disabled,
      loadingType,
      festivalId,
      date,
      tentId,
      defaultPriceCents,
      logConsumption,
      onSuccess,
    ],
  );

  return (
    <HStack className="flex-wrap justify-around gap-2">
      {VISIBLE_DRINK_TYPES.map((type) => {
        const isLoading = loadingType === type;
        const isSuccess = successType === type;
        const color = getDrinkColor(type);
        const isDisabled = disabled || loadingType !== null;

        return (
          <Pressable
            key={type}
            onPress={() => handleQuickAdd(type)}
            disabled={isDisabled}
            className={`min-w-[70px] max-w-[90px] flex-1 items-center justify-center rounded-xl border-2 px-2 py-3 ${
              isSuccess
                ? "border-success-500 bg-success-50"
                : isDisabled
                  ? "border-background-200 bg-background-100"
                  : "border-background-200 active:bg-background-50 bg-white"
            }`}
            accessibilityLabel={getLabel(type)}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled }}
          >
            <VStack space="xs" className="items-center">
              {isLoading ? (
                <ActivityIndicator size="small" color={color} />
              ) : isSuccess ? (
                <Check size={24} color={Colors.success[500]} />
              ) : (
                <DrinkIcon
                  type={type}
                  size={24}
                  color={isDisabled ? IconColors.disabled : color}
                />
              )}
              <Text
                className={`text-xs font-medium ${
                  isSuccess
                    ? "text-success-600"
                    : isDisabled
                      ? "text-typography-400"
                      : "text-typography-700"
                }`}
                numberOfLines={1}
              >
                {isSuccess ? t("common.status.added") : getLabel(type)}
              </Text>
            </VStack>
          </Pressable>
        );
      })}
    </HStack>
  );
}

QuickAddDrinkButtons.displayName = "QuickAddDrinkButtons";
