import type { AttendanceWithTotals, Consumption, DrinkType } from "../schemas/consumption.schema";
import {
  LIVE_ACTIVITY_INACTIVITY_HOURS,
  type LiveActivityMessage,
  type LiveActivityState,
} from "../schemas/live-activity.schema";
import { getCurrentTentId } from "./tent-visits";

export interface BuildLiveActivityStateInput {
  attendance: Pick<AttendanceWithTotals, "drinkCount" | "beerCount" | "tentVisits"> | null;
  consumptions: Pick<Consumption, "drinkType" | "tentId" | "recordedAt">[];
  pendingCount?: number;
  message?: LiveActivityMessage | null;
  /** Stands in for the log time when the only log is an untimed check-in. */
  now?: Date;
}

// Offline check-ins carry only a date, which parses as UTC midnight.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Null when the day has nothing to show (no drinks and no tent visits). */
export function buildLiveActivityState(
  input: BuildLiveActivityStateInput,
): LiveActivityState | null {
  const visits = input.attendance?.tentVisits ?? [];
  const newestDrink = [...input.consumptions].sort(
    (a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt),
  )[0];

  const logTimes = [
    ...visits.filter((v) => !DATE_ONLY.test(v.visitDate)).map((v) => Date.parse(v.visitDate)),
    ...(newestDrink ? [Date.parse(newestDrink.recordedAt)] : []),
  ].filter((time) => !Number.isNaN(time));
  const untimedCheckIn = visits.some((v) => DATE_ONLY.test(v.visitDate));

  if (logTimes.length === 0 && !untimedCheckIn) {
    return null;
  }
  const lastLogAt =
    logTimes.length > 0 ? new Date(Math.max(...logTimes)) : (input.now ?? new Date());

  const currentTentId = getCurrentTentId(visits) ?? null;
  const currentTent = visits.find((v) => v.tentId === currentTentId);

  return {
    drinkCount: input.attendance?.drinkCount ?? 0,
    beerCount: input.attendance?.beerCount ?? 0,
    tentName: currentTent?.tentName ?? null,
    lastDrinkType: newestDrink?.drinkType ?? "beer",
    lastTentId: newestDrink?.tentId ?? currentTentId,
    pendingCount: input.pendingCount ?? 0,
    lastLogAt: lastLogAt.toISOString(),
    message: input.message ?? null,
  };
}

export function liveActivityStaleDate(state: LiveActivityState): string {
  const staleAt = Date.parse(state.lastLogAt) + LIVE_ACTIVITY_INACTIVITY_HOURS * 60 * 60 * 1000;
  return new Date(staleAt).toISOString();
}

export function isLiveActivityStale(state: LiveActivityState, now: Date): boolean {
  return now.getTime() >= Date.parse(liveActivityStaleDate(state));
}

const DRINK_EMOJI: Record<DrinkType, string> = {
  beer: "🍺",
  radler: "🍋",
  alcohol_free: "🚫",
  wine: "🍷",
  soft_drink: "🥤",
  other: "🥂",
};

export function drinkEmoji(type: DrinkType): string {
  return DRINK_EMOJI[type];
}

/** Same rule as the server's attendance_with_totals view: a radler counts as a beer. */
export function countsAsBeer(type: DrinkType): boolean {
  return type === "beer" || type === "radler";
}

/** "3 🍺 · 1 🥂": beers first, every other drink type after. */
export function drinkBreakdown(state: Pick<LiveActivityState, "drinkCount" | "beerCount">): string {
  const others = Math.max(0, state.drinkCount - state.beerCount);
  const parts: string[] = [];
  if (state.beerCount > 0 || others === 0) {
    parts.push(`${state.beerCount} 🍺`);
  }
  if (others > 0) {
    parts.push(`${others} 🥂`);
  }
  return parts.join(" · ");
}
