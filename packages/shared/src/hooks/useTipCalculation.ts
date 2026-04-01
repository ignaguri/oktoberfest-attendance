/**
 * Hook for calculating tip-adjusted prices based on the user's tip preference.
 *
 * Reads tip_mode and tip_fixed_amount from the current user's profile
 * and provides a function to calculate the price paid including tip.
 */

import { useCallback } from "react";

import type { TipMode } from "../schemas";
import { calculatePricePaidCents } from "../utils/pricing";

import { useCurrentProfile } from "./useProfile";

export function useTipCalculation() {
  const { data: profile } = useCurrentProfile();

  const tipMode: TipMode = profile?.tip_mode ?? "ceiling_plus_1";
  const tipFixedAmount = profile?.tip_fixed_amount ?? null;

  const calculatePricePaid = useCallback(
    (basePriceCents: number): number => {
      return calculatePricePaidCents(basePriceCents, tipMode, tipFixedAmount);
    },
    [tipMode, tipFixedAmount],
  );

  return {
    calculatePricePaid,
    tipMode,
    tipFixedAmount,
  };
}
