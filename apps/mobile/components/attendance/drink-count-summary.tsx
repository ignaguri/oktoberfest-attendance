import { useTranslation } from "@prostcounter/shared/i18n";
import type { Consumption, DrinkType } from "@prostcounter/shared/schemas";
import { Beer, CupSoda, Wine } from "lucide-react-native";
import { useMemo } from "react";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DrinkTypeColors, IconColors } from "@/lib/constants/colors";

import { VISIBLE_DRINK_TYPES } from "./drink-type-picker";

interface DrinkCountSummaryProps {
  consumptions: Consumption[];
  totalDrinks?: number;
  showTotal?: boolean;
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
 * Summary component showing total drinks count with breakdown by type
 *
 * Example output:
 * Total: 5 drinks
 * 🍺 3  🍷 2
 */
export function DrinkCountSummary({
  consumptions,
  totalDrinks,
  showTotal = true,
  compact = false,
}: DrinkCountSummaryProps) {
  const { t } = useTranslation();

  // Calculate counts per drink type
  const counts = useMemo(() => {
    const result: Record<DrinkType, number> = {
      beer: 0,
      radler: 0,
      wine: 0,
      soft_drink: 0,
      alcohol_free: 0,
      other: 0,
    };

    consumptions.forEach((c) => {
      if (result[c.drinkType] !== undefined) {
        result[c.drinkType]++;
      }
    });

    return result;
  }, [consumptions]);

  // Filter to only visible types with non-zero counts
  const visibleCounts = useMemo(() => {
    return VISIBLE_DRINK_TYPES.filter((type) => counts[type] > 0).map(
      (type) => ({
        type,
        count: counts[type],
      }),
    );
  }, [counts]);

  const total = totalDrinks ?? consumptions.length;

  if (compact) {
    return (
      <HStack space="md" className="flex-wrap items-center">
        {showTotal && (
          <Text className="text-typography-700 text-sm font-medium">
            {total}
          </Text>
        )}
        {visibleCounts.map(({ type, count }) => (
          <HStack key={type} space="xs" className="items-center">
            <DrinkIcon type={type} size={14} color={getDrinkColor(type)} />
            <Text className="text-typography-600 text-xs">{count}</Text>
          </HStack>
        ))}
      </HStack>
    );
  }

  return (
    <VStack space="xs" className="items-center">
      {showTotal && (
        <Text className="text-typography-500 text-sm">
          {t("attendance.totalDrinks", {
            count: total,
          })}
        </Text>
      )}

      {visibleCounts.length > 0 && (
        <HStack space="md" className="flex-wrap justify-center">
          {visibleCounts.map(({ type, count }) => (
            <HStack key={type} space="xs" className="items-center">
              <DrinkIcon type={type} size={16} color={getDrinkColor(type)} />
              <Text className="text-typography-700 text-sm font-medium">
                {count}
              </Text>
            </HStack>
          ))}
        </HStack>
      )}
    </VStack>
  );
}

DrinkCountSummary.displayName = "DrinkCountSummary";
