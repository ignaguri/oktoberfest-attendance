import { describe, expect, it } from "vitest";

import { pickPastDayLandingTab, shouldLeaveEmptyFriendsTab } from "../past-day-tab";

describe("pickPastDayLandingTab", () => {
  it("lands on attendance when you logged the day", () => {
    expect(pickPastDayLandingTab({ hasAttendance: true, hasReservation: true })).toBe(
      "attendance",
    );
  });

  it("lands on the reservation when that is all you have", () => {
    expect(pickPastDayLandingTab({ hasAttendance: false, hasReservation: true })).toBe(
      "reservation",
    );
  });

  it("lands on friends when you have nothing that day", () => {
    expect(pickPastDayLandingTab({ hasAttendance: false, hasReservation: false })).toBe(
      "friends",
    );
  });
});

describe("shouldLeaveEmptyFriendsTab", () => {
  const landedOnEmptyFriends = {
    activeTab: "friends",
    landingTab: "friends",
    userChoseTab: false,
    friendsCount: 0,
  };

  it("leaves when the landing tab turned out empty", () => {
    expect(shouldLeaveEmptyFriendsTab(landedOnEmptyFriends)).toBe(true);
  });

  it("waits while friends are loading", () => {
    expect(shouldLeaveEmptyFriendsTab({ ...landedOnEmptyFriends, friendsCount: null })).toBe(
      false,
    );
  });

  it("stays when friends went", () => {
    expect(shouldLeaveEmptyFriendsTab({ ...landedOnEmptyFriends, friendsCount: 2 })).toBe(false);
  });

  it("stays on a tab the user picked", () => {
    expect(shouldLeaveEmptyFriendsTab({ ...landedOnEmptyFriends, userChoseTab: true })).toBe(
      false,
    );
  });

  it("ignores a stale friends tab when the day lands elsewhere", () => {
    expect(
      shouldLeaveEmptyFriendsTab({ ...landedOnEmptyFriends, landingTab: "reservation" }),
    ).toBe(false);
  });

  it("does nothing on other tabs", () => {
    expect(shouldLeaveEmptyFriendsTab({ ...landedOnEmptyFriends, activeTab: "attendance" })).toBe(
      false,
    );
  });
});
