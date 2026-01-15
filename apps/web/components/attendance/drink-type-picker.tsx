"use client";

import { RadlerIcon } from "@/components/icons/radler-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Beer, Wine, GlassWater, CupSoda, BeerOff } from "lucide-react";

import type { DrinkType } from "@prostcounter/shared/schemas";
import type { TFunction } from "i18next";

/**
 * Visible drink types for the picker (subset of all DrinkType values)
 */
export const VISIBLE_DRINK_TYPES: DrinkType[] = [
  "beer",
  "radler",
  "alcohol_free",
  "wine",
  "soft_drink",
];

/**
 * Drink type colors for icons and backgrounds
 */
export const DRINK_TYPE_COLORS: Record<DrinkType, string> = {
  beer: "text-amber-500",
  radler: "text-lime-500",
  wine: "text-purple-500",
  soft_drink: "text-blue-500",
  alcohol_free: "text-teal-500",
  other: "text-gray-500",
};

export const DRINK_TYPE_BG_COLORS: Record<DrinkType, string> = {
  beer: "bg-amber-500",
  radler: "bg-lime-500",
  wine: "bg-purple-500",
  soft_drink: "bg-blue-500",
  alcohol_free: "bg-teal-500",
  other: "bg-gray-500",
};

export const DRINK_TYPE_BORDER_COLORS: Record<DrinkType, string> = {
  beer: "border-amber-500 ring-amber-500",
  radler: "border-lime-500 ring-lime-500",
  wine: "border-purple-500 ring-purple-500",
  soft_drink: "border-blue-500 ring-blue-500",
  alcohol_free: "border-teal-500 ring-teal-500",
  other: "border-gray-500 ring-gray-500",
};

interface DrinkTypePickerProps {
  selectedType: DrinkType;
  onSelect: (type: DrinkType) => void;
  counts?: Record<DrinkType, number>;
  disabled?: boolean;
  showLabels?: boolean;
  /** Use responsive 2x2 grid on small screens */
  responsive?: boolean;
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
      return <Beer className={iconClass} />;
    case "radler":
      return <RadlerIcon className={className} />;
    case "wine":
      return <Wine className={iconClass} />;
    case "soft_drink":
      return <CupSoda className={iconClass} />;
    case "alcohol_free":
      return <BeerOff className={iconClass} />;
    default:
      return <GlassWater className={iconClass} />;
  }
}

/**
 * Get the label for a drink type
 */
export function getDrinkTypeLabel(type: DrinkType, t: TFunction): string {
  switch (type) {
    case "beer":
      return t("attendance.drinkTypes.beer");
    case "radler":
      return t("attendance.drinkTypes.radler");
    case "wine":
      return t("attendance.drinkTypes.wine");
    case "soft_drink":
      return t("attendance.drinkTypes.soft_drink");
    case "alcohol_free":
      return t("attendance.drinkTypes.alcohol_free");
    default:
      return t("attendance.drinkTypes.other");
  }
}

/**
 * Drink type picker with icon buttons and optional count badges
 *
 * Features:
 * - Horizontal row of drink type buttons
 * - Selected state with primary color highlight
 * - Optional count badges
 * - Shows selected type label underneath
 * - Works with shadcn/ui Button component
 */
export function DrinkTypePicker({
  selectedType,
  onSelect,
  counts = {} as Record<DrinkType, number>,
  disabled = false,
  showLabels = false,
  responsive = false,
  className,
}: DrinkTypePickerProps) {
  const { t } = useTranslation();

  // Split into two rows for responsive layout: 3 on first row, 2 on second
  const firstRow = VISIBLE_DRINK_TYPES.slice(0, 3);
  const secondRow = VISIBLE_DRINK_TYPES.slice(3);

  const renderButton = (type: DrinkType) => {
    const isSelected = selectedType === type;
    const count = counts[type] || 0;

    return (
      <Button
        key={type}
        type="button"
        variant="outline"
        size={showLabels ? "default" : "icon"}
        onClick={() => onSelect(type)}
        disabled={disabled}
        className={cn(
          "relative",
          isSelected &&
            `ring-2 ring-offset-2 ${DRINK_TYPE_BORDER_COLORS[type]}`,
          !showLabels && "h-12 w-12",
        )}
      >
        <DrinkIcon
          type={type}
          className={cn(
            isSelected ? DRINK_TYPE_COLORS[type] : DRINK_TYPE_COLORS[type],
          )}
        />
        {showLabels && (
          <span className="ml-1">{getDrinkTypeLabel(type, t)}</span>
        )}

        {/* Count badge */}
        {count > 0 && (
          <Badge
            variant="secondary"
            className={cn(
              "absolute -top-2 -right-2 h-5 min-w-[20px] px-1 text-xs",
              DRINK_TYPE_BG_COLORS[type],
              "border-0 text-white",
            )}
          >
            {count}
          </Badge>
        )}
      </Button>
    );
  };

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {responsive ? (
        // Responsive layout: two flex rows, second row centered
        <div className="flex flex-col items-center gap-2">
          <div className="flex justify-center gap-2">
            {firstRow.map(renderButton)}
          </div>
          <div className="flex justify-center gap-2">
            {secondRow.map(renderButton)}
          </div>
        </div>
      ) : (
        // Default layout: single row
        <div className="flex justify-center gap-2">
          {VISIBLE_DRINK_TYPES.map(renderButton)}
        </div>
      )}
      {/* Selected type label - hide in responsive mode since label is shown elsewhere */}
      {!responsive && (
        <span className="text-muted-foreground text-sm font-medium">
          {getDrinkTypeLabel(selectedType, t)}
        </span>
      )}
    </div>
  );
}
