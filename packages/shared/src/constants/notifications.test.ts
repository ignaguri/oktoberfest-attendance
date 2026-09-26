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

describe("getNotificationRoute for day start", () => {
  it("opens home from a push", () => {
    expect(getNotificationRoute({ type: NOTIFICATION_PUSH_TYPES.DAY_START })).toBe("/home");
  });
});

describe("getNotificationRoute for group messages", () => {
  it("opens the group's messages screen for the resolved deep link", () => {
    expect(
      getNotificationRoute({
        type: NOTIFICATION_PUSH_TYPES.GROUP_MESSAGE,
        groupId: "group-1",
      }),
    ).toBe("/group-detail/group-1/messages");
  });

  it("falls back to the groups list when no shared group could be resolved", () => {
    expect(getNotificationRoute({ type: NOTIFICATION_PUSH_TYPES.GROUP_MESSAGE })).toBe("/groups");
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

describe("getNotificationRoute for group invitations", () => {
  const GROUP_ID = "33333333-3333-4333-8333-333333333333";

  it("sends an invitation to the groups list, never to the group itself", () => {
    // The recipient is not a member yet, so /group-detail would reject them
    expect(
      getNotificationRoute({
        type: NOTIFICATION_PUSH_TYPES.GROUP_INVITATION,
        groupId: GROUP_ID,
        groupName: "Bierfreunde",
        inviterName: "ana",
      }),
    ).toBe("/groups");
  });

  it("sends an in-app invitation payload to the groups list too", () => {
    expect(getNotificationRoute({ inviterName: "ana", groupId: GROUP_ID })).toBe("/groups");
  });

  it("opens the group when an invitation is accepted", () => {
    expect(
      getNotificationRoute({
        type: NOTIFICATION_PUSH_TYPES.GROUP_INVITATION_ACCEPTED,
        groupId: GROUP_ID,
      }),
    ).toBe(`/group-detail/${GROUP_ID}`);
  });

  it("falls back to the groups list when an acceptance has no group", () => {
    expect(
      getNotificationRoute({ type: NOTIFICATION_PUSH_TYPES.GROUP_INVITATION_ACCEPTED }),
    ).toBe("/groups");
  });
});

describe("getNotificationRoute for photo reactions", () => {
  const GROUP_ID = "0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b";

  it("opens the gallery of the group the reaction was made in", () => {
    expect(
      getNotificationRoute({ type: NOTIFICATION_PUSH_TYPES.PHOTO_REACTION, groupId: GROUP_ID }),
    ).toBe(`/group-detail/${GROUP_ID}/gallery`);
  });

  it("opens the gallery from an in-app payload without a type", () => {
    expect(getNotificationRoute({ reactorName: "user2", groupId: GROUP_ID })).toBe(
      `/group-detail/${GROUP_ID}/gallery`,
    );
  });

  it("falls back to the groups list without a group id", () => {
    expect(getNotificationRoute({ type: NOTIFICATION_PUSH_TYPES.PHOTO_REACTION })).toBe("/groups");
  });
});

describe("getNotificationRoute for photo tags", () => {
  const GROUP_ID = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";

  it("opens the shared group's gallery from a push", () => {
    expect(
      getNotificationRoute({ type: NOTIFICATION_PUSH_TYPES.PHOTO_TAG, groupId: GROUP_ID }),
    ).toBe(`/group-detail/${GROUP_ID}/gallery`);
  });

  it("opens your profile when you share no group with the tagger", () => {
    expect(getNotificationRoute({ type: NOTIFICATION_PUSH_TYPES.PHOTO_TAG })).toBe("/profile");
  });

  it("routes an in-app payload without a type by its tagger", () => {
    expect(getNotificationRoute({ taggerName: "user2", groupId: GROUP_ID })).toBe(
      `/group-detail/${GROUP_ID}/gallery`,
    );
    expect(getNotificationRoute({ taggerName: "user2" })).toBe("/profile");
  });
});
