"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";
import { useCallback } from "react";

import type { DrinkType } from "@prostcounter/shared/schemas";

interface LocalDrinkStepperProps {
  drinkType: DrinkType;
  count: number;
  onChange: (drinkType: DrinkType, newCount: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Local drink stepper that manages state locally without API calls.
 * Use this in forms where you want to batch save changes.
 *
 * Features:
 * - Shows count for the specified drink type
 * - +/- buttons update local state via onChange callback
 * - Min/max constraints
 */
export function LocalDrinkStepper({
  drinkType,
  count,
  onChange,
  min = 0,
  max = 99,
  disabled = false,
  className,
}: LocalDrinkStepperProps) {
  const canDecrement = count > min && !disabled;
  const canIncrement = count < max && !disabled;

  const handleDecrement = useCallback(() => {
    if (!canDecrement) return;
    onChange(drinkType, count - 1);
  }, [canDecrement, drinkType, count, onChange]);

  const handleIncrement = useCallback(() => {
    if (!canIncrement) return;
    onChange(drinkType, count + 1);
  }, [canIncrement, drinkType, count, onChange]);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* Decrement button */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleDecrement}
        disabled={!canDecrement}
        className={cn(
          "h-10 w-10 rounded-full",
          canDecrement &&
            "border-yellow-500 text-yellow-600 hover:bg-yellow-50",
        )}
      >
        <Minus className="h-4 w-4" />
      </Button>

      {/* Count display */}
      <span
        className={cn(
          "min-w-[40px] text-center text-3xl font-bold",
          disabled ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {count}
      </span>

      {/* Increment button */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleIncrement}
        disabled={!canIncrement}
        className={cn(
          "h-10 w-10 rounded-full",
          canIncrement &&
            "border-yellow-500 text-yellow-600 hover:bg-yellow-50",
        )}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
