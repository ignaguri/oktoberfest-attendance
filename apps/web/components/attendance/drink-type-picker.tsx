"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Beer, Wine, GlassWater, CupSoda } from "lucide-react";

import type { DrinkType } from "@prostcounter/shared/schemas";

/**
 * Visible drink types for the picker (subset of all DrinkType values)
 */
export const VISIBLE_DRINK_TYPES: DrinkType[] = [
  "beer",
  "radler",
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
    case "radler":
      return <Beer className={iconClass} />;
    case "wine":
      return <Wine className={iconClass} />;
    case "soft_drink":
      return <CupSoda className={iconClass} />;
    case "alcohol_free":
      return <GlassWater className={iconClass} />;
    default:
      return <GlassWater className={iconClass} />;
  }
}

/**
 * Get the label for a drink type
 */
export function getDrinkTypeLabel(type: DrinkType): string {
  switch (type) {
    case "beer":
      return "Beer";
    case "radler":
      return "Radler";
    case "wine":
      return "Wine";
    case "soft_drink":
      return "Soft";
    case "alcohol_free":
      return "AF";
    default:
      return type;
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
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "flex justify-center gap-2",
          responsive && "grid grid-cols-2 sm:flex sm:grid-cols-none",
        )}
      >
        {VISIBLE_DRINK_TYPES.map((type) => {
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
                  isSelected
                    ? DRINK_TYPE_COLORS[type]
                    : DRINK_TYPE_COLORS[type],
                )}
              />
              {showLabels && (
                <span className="ml-1">{getDrinkTypeLabel(type)}</span>
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
        })}
      </div>
      {/* Selected type label */}
      <span className="text-muted-foreground text-sm font-medium">
        {getDrinkTypeLabel(selectedType)}
      </span>
    </div>
  );
}
