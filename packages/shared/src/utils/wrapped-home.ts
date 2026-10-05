import type { WrappedFestival } from "../schemas/wrapped.schema";
import { type FestivalDates, getFestivalCountdown } from "./festival-countdown";

/** The Home countdown covers the festival's last this-many days */
export const WRAPPED_COUNTDOWN_DAYS = 3;

export type WrappedHomeState =
  | { kind: "countdown"; daysUntilUnlock: number }
  | { kind: "ready" }
  | { kind: "viewed" }
  | null;

/**
 * What the Home Wrapped card shows for a festival: a countdown over its last
 * days, the ready state once unlocked and unviewed, a way back in once
 * viewed, or nothing.
 * wrappedFestivals is useWrappedFestivals(): only unlocked festivals the user attended.
 */
export function getWrappedHomeState(
  festival: FestivalDates & { id: string },
  now: Date,
  wrappedFestivals: Pick<WrappedFestival, "festivalId" | "viewed">[] | undefined,
): WrappedHomeState {
  const unlocked = wrappedFestivals?.find((entry) => entry.festivalId === festival.id);
  if (unlocked) {
    return unlocked.viewed ? { kind: "viewed" } : { kind: "ready" };
  }

  const countdown = getFestivalCountdown(festival, now);
  if (countdown.phase !== "live" || countdown.currentDay === null) {
    return null;
  }

  // Wrapped unlocks the day after the last day, so the last day is 1
  const daysUntilUnlock = countdown.totalDays - countdown.currentDay + 1;
  return daysUntilUnlock <= WRAPPED_COUNTDOWN_DAYS ? { kind: "countdown", daysUntilUnlock } : null;
}
