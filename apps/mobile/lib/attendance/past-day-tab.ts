/**
 * Which tab a past day's sheet shows.
 *
 * Lives in `lib` so vitest can reach it; see ./day-list-entries for why.
 */

export type PastDayTab = "attendance" | "reservation" | "friends";

/** Your own record first; friends only when you logged nothing that day. */
export function pickPastDayLandingTab({
  hasAttendance,
  hasReservation,
}: {
  hasAttendance: boolean;
  hasReservation: boolean;
}): PastDayTab {
  if (hasAttendance) {
    return "attendance";
  }
  if (hasReservation) {
    return "reservation";
  }
  return "friends";
}

/**
 * True when the sheet landed on Friends for a day nobody went, so it should
 * fall back to the attendance form.
 *
 * A tab the user picked is left alone. `friendsCount` is null until the list
 * has loaded. The landing tab has to be Friends too, so a Friends tab left
 * over from the previous day never overrides where this day lands.
 */
export function shouldLeaveEmptyFriendsTab({
  activeTab,
  landingTab,
  userChoseTab,
  friendsCount,
}: {
  activeTab: string;
  landingTab: string;
  userChoseTab: boolean;
  friendsCount: number | null;
}): boolean {
  return (
    activeTab === "friends" && landingTab === "friends" && !userChoseTab && friendsCount === 0
  );
}
