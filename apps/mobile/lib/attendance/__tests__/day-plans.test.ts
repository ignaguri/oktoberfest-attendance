import { describe, expect, it } from "vitest";

import type { DayPlan, FriendGoing } from "@prostcounter/shared/schemas";

import {
  buildDayPlansByDate,
  buildFinishedReservationDates,
  buildFriendsGoingByDate,
  classifyFestivalDay,
  countFriendsByDate,
  dayPlanToReservation,
  formatFriendsBadge,
  resolveCellTopSlot,
} from "../day-plans";

function dayPlan(id: string, date: string, overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    id,
    userId: "u1",
    festivalId: "f1",
    date,
    kind: "plan",
    tentId: null,
    tentName: null,
    note: null,
    visibleToGroups: true,
    startAt: null,
    endAt: null,
    status: null,
    reminderOffsetMinutes: null,
    autoCheckin: null,
    reminderSentAt: null,
    promptSentAt: null,
    processedAt: null,
    createdAt: "2026-09-16T10:00:00Z",
    updatedAt: null,
    ...overrides,
  };
}

function reservation(id: string, date: string, status: DayPlan["status"] = "pending"): DayPlan {
  return dayPlan(id, date, {
    kind: "reservation",
    status,
    tentId: "t1",
    tentName: "Augustiner-Festhalle",
    startAt: `${date}T14:00:00Z`,
    reminderOffsetMinutes: 30,
    autoCheckin: false,
  });
}

function friend(userId: string): FriendGoing {
  return {
    userId,
    username: userId,
    fullName: null,
    avatarUrl: null,
    kind: "plan",
    tentName: null,
    startAt: null,
    note: null,
  };
}

describe("buildDayPlansByDate", () => {
  it("keys plans and pending or confirmed reservations by their date", () => {
    const map = buildDayPlansByDate([
      dayPlan("p1", "2026-09-24"),
      reservation("r1", "2026-09-26"),
      reservation("r2", "2026-09-27", "confirmed"),
    ]);

    expect([...map.keys()].sort()).toEqual(["2026-09-24", "2026-09-26", "2026-09-27"]);
  });

  it("drops reservations that can no longer happen", () => {
    const map = buildDayPlansByDate([
      reservation("cancelled", "2026-09-21", "cancelled"),
      reservation("expired", "2026-09-22", "expired"),
      reservation("checked-in", "2026-09-23", "checked_in"),
    ]);

    expect(map.size).toBe(0);
  });
});

describe("buildFinishedReservationDates", () => {
  it("collects the days whose reservation already happened", () => {
    const dates = buildFinishedReservationDates([
      dayPlan("p1", "2026-09-20"),
      reservation("pending", "2026-09-21"),
      reservation("cancelled", "2026-09-22", "cancelled"),
      reservation("checked-in", "2026-09-23", "checked_in"),
      reservation("expired", "2026-09-24", "expired"),
    ]);

    expect([...dates].sort()).toEqual(["2026-09-23", "2026-09-24"]);
  });
});

describe("dayPlanToReservation", () => {
  it("maps a reservation row to the reservation shape", () => {
    expect(dayPlanToReservation(reservation("r1", "2026-09-26"))).toMatchObject({
      id: "r1",
      tentId: "t1",
      tentName: "Augustiner-Festhalle",
      startAt: "2026-09-26T14:00:00Z",
      status: "pending",
      reminderOffsetMinutes: 30,
      autoCheckin: false,
    });
  });

  it("returns null for a plan", () => {
    expect(dayPlanToReservation(dayPlan("p1", "2026-09-26"))).toBeNull();
  });
});

describe("friends going maps", () => {
  it("indexes users by date and counts them", () => {
    const byDate = buildFriendsGoingByDate([
      { date: "2026-09-26", users: [friend("ana"), friend("juan")] },
      { date: "2026-09-27", users: [friend("kathi")] },
    ]);

    expect(byDate.get("2026-09-26")?.map((user) => user.userId)).toEqual(["ana", "juan"]);
    expect([...countFriendsByDate(byDate).entries()]).toEqual([
      ["2026-09-26", 2],
      ["2026-09-27", 1],
    ]);
  });
});

describe("formatFriendsBadge", () => {
  it("caps the badge at 9+", () => {
    expect(formatFriendsBadge(1)).toBe("1");
    expect(formatFriendsBadge(9)).toBe("9");
    expect(formatFriendsBadge(10)).toBe("9+");
  });
});

describe("resolveCellTopSlot", () => {
  it("lets today win over the month label", () => {
    expect(resolveCellTopSlot({ isToday: true, isFirstOfMonth: true })).toBe("today");
    expect(resolveCellTopSlot({ isToday: false, isFirstOfMonth: true })).toBe("month");
    expect(resolveCellTopSlot({ isToday: false, isFirstOfMonth: false })).toBe("none");
  });
});

describe("classifyFestivalDay", () => {
  // UTC+14 all year, so the test machine's own clock can't make these pass.
  const FESTIVAL_TIMEZONE = "Pacific/Kiritimati";
  // 11:00 UTC on Sep 20 is already 01:00 on Sep 21 in the festival's timezone.
  const NOW = new Date("2026-09-20T11:00:00Z");

  it("uses the festival's date for today", () => {
    expect(classifyFestivalDay(new Date(2026, 8, 21), NOW, FESTIVAL_TIMEZONE)).toBe("today");
  });

  it("treats the phone's today as past once the festival's day moved on", () => {
    expect(classifyFestivalDay(new Date(2026, 8, 20), NOW, FESTIVAL_TIMEZONE)).toBe("past");
  });

  it("treats later days as future", () => {
    expect(classifyFestivalDay(new Date(2026, 8, 22), NOW, FESTIVAL_TIMEZONE)).toBe("future");
  });
});
