"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useLogConsumption,
  useDeleteConsumption,
} from "@prostcounter/shared/hooks";
import { Minus, Plus, Loader2 } from "lucide-react";
import { useCallback, useMemo } from "react";

import type { DrinkType, Consumption } from "@prostcounter/shared/schemas";

interface DrinkStepperProps {
  festivalId: string;
  date: string;
  drinkType: DrinkType;
  tentId?: string;
  consumptions: Consumption[];
  defaultPriceCents?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onSuccess?: () => void;
  className?: string;
}

/**
 * Drink stepper that creates/deletes consumptions via API
 *
 * Features:
 * - Shows count for the specified drink type
 * - + button creates a new consumption
 * - - button deletes the most recent consumption of that type
 * - Loading states during API calls
 */
export function DrinkStepper({
  festivalId,
  date,
  drinkType,
  tentId,
  consumptions,
  defaultPriceCents = 1620,
  min = 0,
  max = 99,
  disabled = false,
  onSuccess,
  className,
}: DrinkStepperProps) {
  const logConsumption = useLogConsumption();
  const deleteConsumption = useDeleteConsumption();

  // Filter consumptions by drink type and calculate count
  const typeConsumptions = useMemo(() => {
    return consumptions.filter((c) => c.drinkType === drinkType);
  }, [consumptions, drinkType]);

  const count = typeConsumptions.length;

  // Get the most recent consumption of this type (for deletion)
  const mostRecentConsumption = useMemo(() => {
    if (typeConsumptions.length === 0) return null;
    return typeConsumptions.reduce((latest, current) => {
      return new Date(current.recordedAt) > new Date(latest.recordedAt)
        ? current
        : latest;
    });
  }, [typeConsumptions]);

  const isLoading = logConsumption.loading || deleteConsumption.loading;
  const canDecrement = count > min && !disabled && !isLoading;
  const canIncrement = count < max && !disabled && !isLoading;

  const handleDecrement = useCallback(async () => {
    if (!canDecrement || !mostRecentConsumption) return;

    try {
      await deleteConsumption.mutateAsync(mostRecentConsumption.id);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to delete consumption:", error);
    }
  }, [canDecrement, mostRecentConsumption, deleteConsumption, onSuccess]);

  const handleIncrement = useCallback(async () => {
    if (!canIncrement) return;

    try {
      await logConsumption.mutateAsync({
        festivalId,
        date,
        drinkType,
        tentId,
        pricePaidCents: defaultPriceCents,
        volumeMl: 1000,
      });
      onSuccess?.();
    } catch (error) {
      console.error("Failed to log consumption:", error);
    }
  }, [
    canIncrement,
    festivalId,
    date,
    drinkType,
    tentId,
    defaultPriceCents,
    logConsumption,
    onSuccess,
  ]);

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
        {deleteConsumption.loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Minus className="h-4 w-4" />
        )}
      </Button>

      {/* Count display */}
      <span
        className={cn(
          "min-w-[40px] text-center text-3xl font-bold",
          disabled || isLoading ? "text-muted-foreground" : "text-foreground",
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
        {logConsumption.loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
