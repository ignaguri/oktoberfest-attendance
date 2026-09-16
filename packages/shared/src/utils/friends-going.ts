import type { FriendGoing, FriendsGoingDay } from "../schemas/day-plan.schema";

export type FriendGoingRow = FriendGoing & { date: string };

function sortName(friend: FriendGoing): string {
  return (friend.username ?? friend.fullName ?? "").toLocaleLowerCase();
}

/**
 * Group friends' plans by day, soonest day first.
 *
 * Within a day, reservations lead: someone with a table is the most useful
 * thing to know when deciding whether to go. Then names, alphabetically.
 */
export function groupFriendsGoing(rows: FriendGoingRow[]): FriendsGoingDay[] {
  const usersByDate = new Map<string, FriendGoing[]>();

  for (const { date, ...friend } of rows) {
    const users = usersByDate.get(date) ?? [];
    users.push(friend);
    usersByDate.set(date, users);
  }

  return [...usersByDate.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, users]) => ({
      date,
      users: users.sort((a, b) => {
        if (a.kind !== b.kind) {
          return a.kind === "reservation" ? -1 : 1;
        }
        return sortName(a).localeCompare(sortName(b));
      }),
    }));
}
