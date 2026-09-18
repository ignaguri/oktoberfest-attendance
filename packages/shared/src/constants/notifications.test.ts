import { describe, expect, it } from "vitest";

import { getNotificationRoute, NOTIFICATION_PUSH_TYPES } from "./notifications";

describe("getNotificationRoute for friend plan overlaps", () => {
  it("opens the attendance sheet for the day from a push", () => {
    expect(
      getNotificationRoute({
        type: NOTIFICATION_PUSH_TYPES.FRIEND_PLAN_OVERLAP,
        date: "2026-09-26",
      }),
    ).toBe("/attendance?date=2026-09-26");
  });

  it("opens the attendance sheet for the day from an in-app payload", () => {
    expect(getNotificationRoute({ actorName: "ana", date: "2026-09-26" })).toBe(
      "/attendance?date=2026-09-26",
    );
  });

  it("keeps the festival so the day opens in the right one", () => {
    expect(
      getNotificationRoute({
        type: NOTIFICATION_PUSH_TYPES.FRIEND_PLAN_OVERLAP,
        date: "2026-09-26",
        festivalId: "festival-1",
      }),
    ).toBe("/attendance?date=2026-09-26&festivalId=festival-1");
    expect(
      getNotificationRoute({ actorName: "ana", date: "2026-09-26", festivalId: "festival-1" }),
    ).toBe("/attendance?date=2026-09-26&festivalId=festival-1");
  });

  it("falls back to the attendance screen without a date", () => {
    expect(getNotificationRoute({ type: NOTIFICATION_PUSH_TYPES.FRIEND_PLAN_OVERLAP })).toBe(
      "/attendance",
    );
  });
});

describe("getNotificationRoute for group join requests", () => {
  it("opens the group's settings for the creator from a push", () => {
    expect(
      getNotificationRoute({
        type: NOTIFICATION_PUSH_TYPES.GROUP_JOIN_REQUEST,
        groupId: "group-1",
      }),
    ).toBe("/group-detail/group-1/settings");
  });

  it("opens the group's settings from an in-app payload without a type", () => {
    expect(getNotificationRoute({ requesterName: "ana", groupId: "group-1" })).toBe(
      "/group-detail/group-1/settings",
    );
  });

  it("opens the group for the accepted requester", () => {
    expect(
      getNotificationRoute({
        type: NOTIFICATION_PUSH_TYPES.GROUP_JOIN_REQUEST_ACCEPTED,
        groupId: "group-1",
      }),
    ).toBe("/group-detail/group-1");
  });

  it("falls back to the groups list without a group id", () => {
    expect(getNotificationRoute({ type: NOTIFICATION_PUSH_TYPES.GROUP_JOIN_REQUEST })).toBe(
      "/groups",
    );
  });
});
