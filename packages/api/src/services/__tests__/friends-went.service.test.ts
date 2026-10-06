import type { FriendsWentRows } from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { describe, expect, it, vi } from "vitest";

import type { IFriendsWentRepository } from "../../repositories/interfaces";
import { FriendsWentService } from "../friends-went.service";

const VIEWER_ID = "11111111-1111-4111-8111-111111111111";
const FESTIVAL_ID = "22222222-2222-4222-8222-222222222222";
const FRIEND_ID = "33333333-3333-4333-8333-333333333333";
const ATTENDANCE_ID = "44444444-4444-4444-8444-444444444444";
/** 12:00 in Munich on Sunday Sep 20. */
const NOW = new Date("2026-09-20T10:00:00Z");

function dayRows(): FriendsWentRows {
  return {
    attendances: [{ attendanceId: ATTENDANCE_ID, userId: FRIEND_ID }],
    profiles: [{ userId: FRIEND_ID, username: "ana", fullName: null, avatarUrl: null }],
    consumptions: [{ attendanceId: ATTENDANCE_ID, drinkType: "beer" }],
    tentVisits: [],
    photos: [],
    viewerGroups: [],
    groupMemberships: [],
  };
}

function createRepo(timezone: string | null = "Europe/Berlin") {
  return {
    getFestivalTimezone: vi.fn().mockResolvedValue(timezone),
    listDayRows: vi.fn().mockResolvedValue(dayRows()),
  };
}

function createService(repo: ReturnType<typeof createRepo>, now: Date = NOW) {
  return new FriendsWentService(repo as unknown as IFriendsWentRepository, () => now);
}

describe("FriendsWentService", () => {
  it("rejects an unknown festival", async () => {
    const repo = createRepo(null);

    await expect(
      createService(repo).getFriendsWent(VIEWER_ID, FESTIVAL_ID, "2026-09-19"),
    ).rejects.toMatchObject({ code: ErrorCodes.FESTIVAL_NOT_FOUND });
  });

  it("includes today so far", async () => {
    const repo = createRepo();

    const friends = await createService(repo).getFriendsWent(VIEWER_ID, FESTIVAL_ID, "2026-09-20");

    expect(repo.listDayRows).toHaveBeenCalledWith(VIEWER_ID, FESTIVAL_ID, "2026-09-20");
    expect(friends).toHaveLength(1);
  });

  it("returns nobody for a future day", async () => {
    const repo = createRepo();

    expect(await createService(repo).getFriendsWent(VIEWER_ID, FESTIVAL_ID, "2026-09-21")).toEqual(
      [],
    );
    expect(repo.listDayRows).not.toHaveBeenCalled();
  });

  it("groups a past day's rows", async () => {
    const repo = createRepo();

    const friends = await createService(repo).getFriendsWent(VIEWER_ID, FESTIVAL_ID, "2026-09-19");

    expect(repo.listDayRows).toHaveBeenCalledWith(VIEWER_ID, FESTIVAL_ID, "2026-09-19");
    expect(friends).toEqual([
      expect.objectContaining({ userId: FRIEND_ID, username: "ana", totalDrinks: 1 }),
    ]);
  });

  it("decides what is a later day on the festival's clock", async () => {
    // 00:30 on Sep 20 in Munich, still 18:30 on Sep 19 in New York
    const lateNight = new Date("2026-09-19T22:30:00Z");

    const munich = createRepo("Europe/Berlin");
    const newYork = createRepo("America/New_York");
    await createService(munich, lateNight).getFriendsWent(VIEWER_ID, FESTIVAL_ID, "2026-09-20");
    await createService(newYork, lateNight).getFriendsWent(VIEWER_ID, FESTIVAL_ID, "2026-09-20");

    expect(munich.listDayRows).toHaveBeenCalled();
    expect(newYork.listDayRows).not.toHaveBeenCalled();
  });
});
