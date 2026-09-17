import { describe, expect, it } from "vitest";

import { type FriendGoingRow, groupFriendsGoing } from "./friends-going";

function row(overrides: Partial<FriendGoingRow>): FriendGoingRow {
  return {
    date: "2026-09-26",
    userId: "11111111-1111-4111-8111-111111111111",
    username: null,
    fullName: null,
    avatarUrl: null,
    kind: "plan",
    tentName: null,
    startAt: null,
    note: null,
    companions: { users: [], groups: [] },
    ...overrides,
  };
}

describe("groupFriendsGoing", () => {
  it("groups rows by day, soonest day first", () => {
    const days = groupFriendsGoing([
      row({ date: "2026-09-27", username: "juan" }),
      row({ date: "2026-09-26", username: "ana" }),
      row({ date: "2026-09-27", username: "kathi" }),
    ]);

    expect(days.map((day) => day.date)).toEqual(["2026-09-26", "2026-09-27"]);
    expect(days[1].users.map((user) => user.username)).toEqual(["juan", "kathi"]);
  });

  it("puts reservations before plans, then sorts by name ignoring case", () => {
    const [day] = groupFriendsGoing([
      row({ username: "lukas" }),
      row({ username: "Martín", kind: "reservation" }),
      row({ username: null, fullName: "ana" }),
      row({ username: "ana-r", kind: "reservation" }),
    ]);

    expect(day.users.map((user) => user.username ?? user.fullName)).toEqual([
      "ana-r",
      "Martín",
      "ana",
      "lukas",
    ]);
  });

  it("drops the date from each user", () => {
    const [day] = groupFriendsGoing([row({ username: "ana" })]);

    expect(day.users[0]).not.toHaveProperty("date");
  });

  it("returns nothing for no rows", () => {
    expect(groupFriendsGoing([])).toEqual([]);
  });
});
