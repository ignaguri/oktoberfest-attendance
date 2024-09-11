import type { Session } from "@supabase/supabase-js";

export type MaybeSession = Session | null;

export enum WinningCriteria {
  days_attended = "days_attended",
  total_beers = "total_beers",
  avg_beers = "avg_beers",
}

export const WinningCriteriaValues = {
  days_attended: WinningCriteria.days_attended,
  total_beers: WinningCriteria.total_beers,
  avg_beers: WinningCriteria.avg_beers,
} as const;
