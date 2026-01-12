"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLogConsumption } from "@prostcounter/shared/hooks";
import { Beer, Wine, CupSoda, Check, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";

import type { DrinkType } from "@prostcounter/shared/schemas";

/**
 * Visible drink types for the picker
 */
export const VISIBLE_DRINK_TYPES: DrinkType[] = [
  "beer",
  "radler",
  "wine",
  "soft_drink",
];

/**
 * Drink type colors
 */
const DRINK_TYPE_COLORS: Record<DrinkType, string> = {
  beer: "text-amber-500 hover:text-amber-600",
  radler: "text-lime-500 hover:text-lime-600",
  wine: "text-purple-500 hover:text-purple-600",
  soft_drink: "text-blue-500 hover:text-blue-600",
  alcohol_free: "text-teal-500 hover:text-teal-600",
  other: "text-gray-500 hover:text-gray-600",
};

interface QuickAddDrinkButtonsProps {
  festivalId: string;
  date: string;
  tentId?: string;
  defaultPriceCents?: number;
  disabled?: boolean;
  onSuccess?: () => void;
  className?: string;
}

/**
 * Get the icon component for a drink type
 */
function DrinkIcon({
  type,
  className,
}: {
  type: DrinkType;
  className?: string;
}) {
  const iconClass = cn("h-5 w-5", className);

  switch (type) {
    case "beer":
    case "radler":
      return <Beer className={iconClass} />;
    case "wine":
      return <Wine className={iconClass} />;
    case "soft_drink":
      return <CupSoda className={iconClass} />;
    default:
      return <Beer className={iconClass} />;
  }
}

/**
 * Get the label for a drink type
 */
function getLabel(type: DrinkType): string {
  switch (type) {
    case "beer":
      return "+1 Beer";
    case "radler":
      return "+1 Radler";
    case "wine":
      return "+1 Wine";
    case "soft_drink":
      return "+1 Soft";
    default:
      return `+1 ${type}`;
  }
}

/**
 * Quick +1 buttons for each drink type
 *
 * Features:
 * - One button per drink type
 * - Each click logs a consumption directly
 * - Success animation (checkmark) after click
 * - Loading states
 */
export function QuickAddDrinkButtons({
  festivalId,
  date,
  tentId,
  defaultPriceCents = 1620,
  disabled = false,
  onSuccess,
  className,
}: QuickAddDrinkButtonsProps) {
  const logConsumption = useLogConsumption();
  const [successType, setSuccessType] = useState<DrinkType | null>(null);
  const [loadingType, setLoadingType] = useState<DrinkType | null>(null);

  const handleQuickAdd = useCallback(
    async (type: DrinkType) => {
      if (disabled || loadingType) return;

      setLoadingType(type);

      try {
        await logConsumption.mutateAsync({
          festivalId,
          date,
          drinkType: type,
          tentId,
          pricePaidCents: defaultPriceCents,
          volumeMl: 1000,
        });

        // Show success animation
        setSuccessType(type);
        onSuccess?.();

        // Clear success after animation
        setTimeout(() => setSuccessType(null), 1500);
      } catch (error) {
        console.error("Failed to log consumption:", error);
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
    <div className={cn("flex flex-wrap justify-center gap-2", className)}>
      {VISIBLE_DRINK_TYPES.map((type) => {
        const isLoading = loadingType === type;
        const isSuccess = successType === type;
        const isDisabled = disabled || loadingType !== null;

        return (
          <Button
            key={type}
            type="button"
            variant={isSuccess ? "default" : "outline"}
            onClick={() => handleQuickAdd(type)}
            disabled={isDisabled}
            className={cn(
              "flex min-w-[90px] gap-1",
              isSuccess && "bg-green-500 hover:bg-green-500",
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSuccess ? (
              <Check className="h-4 w-4" />
            ) : (
              <DrinkIcon type={type} className={DRINK_TYPE_COLORS[type]} />
            )}
            <span className="text-sm">
              {isSuccess ? "Added!" : getLabel(type)}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
