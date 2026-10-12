import { describe, expect, it, vi } from "vitest";

import { logger } from "../../../lib/logger";

import type { LiveActivityTokenRecord } from "../../../repositories/interfaces";
import { LiveActivityPushService, type LiveActivityPushDeps } from "../live-activity-push.service";

const festivalId = "123e4567-e89b-12d3-a456-426614174000";
const now = new Date("2026-10-03T12:00:00.000Z"); // 14:00 in Berlin, still Oct 3

const token = (overrides: Partial<LiveActivityTokenRecord>): LiveActivityTokenRecord => ({
  id: "id-1",
  userId: "user-1",
  platform: "ios",
  token: "ios-token",
  apnsEnvironment: "production",
  festivalId,
  date: "2026-10-03",
  ...overrides,
});

function makeDeps(
  tokens: LiveActivityTokenRecord[],
  overrides: Partial<LiveActivityPushDeps> = {},
) {
  const deleteByIds = vi.fn().mockResolvedValue(undefined);
  const deps: LiveActivityPushDeps = {
    tokens: {
      upsert: vi.fn(),
      deleteToken: vi.fn(),
      listForUser: vi.fn().mockResolvedValue(tokens),
      deleteByIds,
    },
    loadFestival: vi.fn().mockResolvedValue({
      id: festivalId,
      timezone: "Europe/Berlin",
      startDate: "2026-09-19",
      endDate: "2026-10-04",
    }),
    loadDay: vi.fn().mockResolvedValue({
      attendance: { drinkCount: 2, beerCount: 2, tentVisits: [] },
      consumptions: [{ drinkType: "beer", tentId: null, recordedAt: "2026-10-03T11:00:00.000Z" }],
    }),
    apns: { sendLiveActivity: vi.fn().mockResolvedValue({ status: 200, reason: null }) },
    sendExpo: vi.fn().mockResolvedValue({ ok: true, deviceNotRegistered: false }),
    now: () => now,
    ...overrides,
  };
  return { deps, deleteByIds };
}

describe("LiveActivityPushService.notifyUserChanged", () => {
  it("does nothing when the user has no tokens", async () => {
    const { deps } = makeDeps([]);

    await new LiveActivityPushService(deps).notifyUserChanged("user-1");

    expect(deps.loadDay).not.toHaveBeenCalled();
  });

  it("pushes today's state to an iOS token", async () => {
    const { deps } = makeDeps([token({})]);

    await new LiveActivityPushService(deps).notifyUserChanged("user-1");

    expect(deps.apns?.sendLiveActivity).toHaveBeenCalledWith({
      token: "ios-token",
      environment: "production",
      payload: {
        aps: {
          timestamp: Math.floor(now.getTime() / 1000),
          event: "update",
          "content-state": {
            drinkCount: 2,
            beerCount: 2,
            tentName: null,
            lastDrinkType: "beer",
            lastTentId: null,
            pendingCount: 0,
            lastLogAt: "2026-10-03T11:00:00.000Z",
            message: null,
          },
          "stale-date": Math.floor(Date.parse("2026-10-03T13:00:00.000Z") / 1000),
        },
      },
    });
  });

  it("sends Android a data push with the state", async () => {
    const { deps } = makeDeps([
      token({ platform: "android", token: "expo-token", apnsEnvironment: null }),
    ]);

    await new LiveActivityPushService(deps).notifyUserChanged("user-1");

    expect(deps.sendExpo).toHaveBeenCalledWith("expo-token", {
      type: "live-activity",
      state: expect.objectContaining({ drinkCount: 2, lastDrinkType: "beer" }),
      timestamp: now.getTime(),
      userId: "user-1",
    });
  });

  it("ends the surface when the day has nothing left", async () => {
    const { deps } = makeDeps(
      [
        token({}),
        token({ id: "id-2", platform: "android", token: "expo-token", apnsEnvironment: null }),
      ],
      { loadDay: vi.fn().mockResolvedValue({ attendance: null, consumptions: [] }) },
    );

    await new LiveActivityPushService(deps).notifyUserChanged("user-1");

    const apnsCall = vi.mocked(deps.apns!.sendLiveActivity).mock.calls[0][0];
    expect((apnsCall.payload as { aps: { event: string } }).aps.event).toBe("end");
    expect(deps.sendExpo).toHaveBeenCalledWith("expo-token", {
      type: "live-activity",
      state: null,
      timestamp: now.getTime(),
      userId: "user-1",
    });
  });

  it("ends an earlier day's surface before pruning its token", async () => {
    const { deps, deleteByIds } = makeDeps([token({ id: "old", date: "2026-10-02" })]);

    await new LiveActivityPushService(deps).notifyUserChanged("user-1");

    const apnsCall = vi.mocked(deps.apns!.sendLiveActivity).mock.calls[0][0];
    expect((apnsCall.payload as { aps: { event: string } }).aps.event).toBe("end");
    expect(deleteByIds).toHaveBeenCalledWith(["old"]);
  });

  it("prunes dead tokens and keeps going after one send throws", async () => {
    const apns = {
      sendLiveActivity: vi
        .fn()
        .mockRejectedValueOnce(new Error("socket hang up"))
        .mockResolvedValueOnce({ status: 410, reason: "Unregistered" }),
    };
    const { deps, deleteByIds } = makeDeps(
      [
        token({ id: "a", token: "t1" }),
        token({ id: "b", token: "t2" }),
        token({ id: "c", platform: "android", token: "e", apnsEnvironment: null }),
      ],
      { apns, sendExpo: vi.fn().mockResolvedValue({ ok: false, deviceNotRegistered: true }) },
    );

    await new LiveActivityPushService(deps).notifyUserChanged("user-1");

    expect(apns.sendLiveActivity).toHaveBeenCalledTimes(2);
    expect(deleteByIds).toHaveBeenCalledWith(["b", "c"]);
  });

  it("skips iOS tokens when APNs is not configured", async () => {
    const { deps, deleteByIds } = makeDeps([token({})], { apns: null });

    await new LiveActivityPushService(deps).notifyUserChanged("user-1");

    expect(deleteByIds).not.toHaveBeenCalled();
  });

  it("logs a non-dead APNs failure without deleting the token", async () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const apns = {
      sendLiveActivity: vi.fn().mockResolvedValue({ status: 403, reason: "InvalidProviderToken" }),
    };
    const { deps, deleteByIds } = makeDeps([token({})], { apns });

    await new LiveActivityPushService(deps).notifyUserChanged("user-1");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403, reason: "InvalidProviderToken", tokenId: "id-1" }),
      expect.any(String),
    );
    expect(deleteByIds).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("keeps other groups and cleanup when one group's load fails", async () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const loadDay = vi
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce({
        attendance: { drinkCount: 1, beerCount: 1, tentVisits: [] },
        consumptions: [],
      });
    const { deps, deleteByIds } = makeDeps(
      [
        token({ id: "a", festivalId: "f-1" }),
        token({ id: "b", festivalId: "f-2" }),
        token({ id: "old", festivalId: "f-3", date: "2026-10-02" }),
      ],
      { loadDay },
    );

    await new LiveActivityPushService(deps).notifyUserChanged("user-1");

    // f-2's update plus the end sent to f-3's day-old surface; f-1 failed to load.
    expect(deps.apns?.sendLiveActivity).toHaveBeenCalledTimes(2);
    expect(deleteByIds).toHaveBeenCalledWith(["old"]);
    errorSpy.mockRestore();
  });
});
