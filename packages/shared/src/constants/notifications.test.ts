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

  it("falls back to the attendance screen without a date", () => {
    expect(getNotificationRoute({ type: NOTIFICATION_PUSH_TYPES.FRIEND_PLAN_OVERLAP })).toBe(
      "/attendance",
    );
  });
});
