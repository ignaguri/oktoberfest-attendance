/**
 * Pure helpers for the user's day plans and friends' plans, shared by the
 * strip, the day list and the day sheet.
 *
 * Lives in `lib` so vitest can reach it; see ./day-list-entries for why.
 */

import type {
  DayPlan,
  FriendGoing,
  FriendsGoingDay,
  Reservation,
} from "@prostcounter/shared/schemas";

/** A plan always counts; a reservation only while it can still happen. */
export function isActiveDayPlan(plan: DayPlan): boolean {
  if (plan.kind === "plan") {
    return true;
  }
  return plan.status === "pending" || plan.status === "confirmed";
}

/** Active marks by YYYY-MM-DD. The API guarantees at most one per day. */
export function buildDayPlansByDate(plans: DayPlan[]): Map<string, DayPlan> {
  const map = new Map<string, DayPlan>();
  for (const plan of plans) {
    if (isActiveDayPlan(plan)) {
      map.set(plan.date, plan);
    }
  }
  return map;
}

/**
 * The reservation shape the check-in dialog and the past-day summary still
 * expect. Null for a plan.
 */
export function dayPlanToReservation(plan: DayPlan): Reservation | null {
  if (plan.kind !== "reservation" || !plan.tentId || !plan.startAt || !plan.status) {
    return null;
  }

  return {
    id: plan.id,
    userId: plan.userId,
    festivalId: plan.festivalId,
    tentId: plan.tentId,
    tentName: plan.tentName ?? undefined,
    startAt: plan.startAt,
    endAt: plan.endAt,
    status: plan.status,
    note: plan.note,
    visibleToGroups: plan.visibleToGroups,
    autoCheckin: plan.autoCheckin ?? false,
    reminderOffsetMinutes: plan.reminderOffsetMinutes ?? 30,
    reminderSentAt: plan.reminderSentAt,
    promptSentAt: plan.promptSentAt,
    processedAt: plan.processedAt,
    createdAt: plan.createdAt ?? "",
    updatedAt: plan.updatedAt,
  };
}

export function buildFriendsGoingByDate(days: FriendsGoingDay[]): Map<string, FriendGoing[]> {
  return new Map(days.map((day) => [day.date, day.users]));
}

export function countFriendsByDate(friendsByDate: Map<string, FriendGoing[]>): Map<string, number> {
  return new Map([...friendsByDate.entries()].map(([date, users]) => [date, users.length]));
}

/** The corner badge has room for one digit and a plus. */
export function formatFriendsBadge(count: number): string {
  return count > 9 ? "9+" : String(count);
}

export type CellTopSlot = "today" | "month" | "none";

/**
 * What the cell's fixed top slot shows. Today wins on the 1st of a month; the
 * range header above the grid already names the month.
 */
export function resolveCellTopSlot({
  isToday,
  isFirstOfMonth,
}: {
  isToday: boolean;
  isFirstOfMonth: boolean;
}): CellTopSlot {
  if (isToday) {
    return "today";
  }
  if (isFirstOfMonth) {
    return "month";
  }
  return "none";
}
