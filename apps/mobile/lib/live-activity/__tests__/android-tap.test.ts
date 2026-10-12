import type { LiveActivityState } from "@prostcounter/shared/schemas";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => {
  class ApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public statusCode: number,
    ) {
      super(message);
    }
  }
  class AuthRequiredError extends Error {}
  return { ApiError, AuthRequiredError, apiClient: {} };
});

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

import { ApiError, AuthRequiredError } from "@/lib/api-client";
import { logger } from "@/lib/logger";
import type { PendingTap } from "@/modules/live-activity";

import { type AndroidTapDeps, applyServerState, handleAndroidTap } from "../android-tap";

const baseState: LiveActivityState = {
  drinkCount: 2,
  beerCount: 2,
  tentName: "Augustiner",
  lastDrinkType: "beer",
  lastTentId: "11111111-1111-4111-8111-111111111111",
  pendingCount: 0,
  lastLogAt: "2026-10-03T10:00:00.000Z",
  message: null,
};

const USER = "user-a";

function makeDeps(overrides: Partial<AndroidTapDeps> = {}) {
  let pending: PendingTap[] = [];
  let ids = 0;
  const rendered: LiveActivityState[] = [];
  const deps: AndroidTapDeps = {
    surface: {
      read: vi.fn().mockResolvedValue({
        attributes: {
          festivalId: "123e4567-e89b-12d3-a456-426614174000",
          festivalName: "Oktoberfest 2026",
          date: "2026-10-03",
          timezone: "Europe/Berlin",
          apiBaseUrl: "http://localhost:3008/api/v1",
        },
        state: baseState,
        labels: {} as never,
      }),
      render: vi.fn(async (state: LiveActivityState) => {
        rendered.push(state);
      }),
      end: vi.fn().mockResolvedValue(undefined),
      appendPending: vi.fn(async (tap: PendingTap) => {
        pending = [...pending, tap];
      }),
      peekPending: vi.fn(async () => pending),
      removePending: vi.fn(async (removeIds: string[]) => {
        pending = pending.filter((tap) => !removeIds.includes(tap.consumptionId));
      }),
    },
    logDrink: vi.fn().mockResolvedValue({ drinkCount: 3, beerCount: 3 }),
    currentUserId: vi.fn().mockResolvedValue(USER),
    now: () => new Date("2026-10-03T11:00:00.000Z"),
    newId: () => `id-${++ids}`,
    ...overrides,
  };
  return { deps, rendered, getPending: () => pending };
}

describe("handleAndroidTap", () => {
  it("logs the last drink and shows the server's count", async () => {
    const { deps, rendered, getPending } = makeDeps();

    await handleAndroidTap(deps);

    expect(deps.logDrink).toHaveBeenCalledWith(
      expect.objectContaining({
        consumptionId: "id-1",
        drinkType: "beer",
        date: "2026-10-03",
      }),
    );
    expect(rendered.at(-1)).toMatchObject({
      drinkCount: 3,
      pendingCount: 0,
      message: null,
    });
    expect(getPending()).toEqual([]);
  });

  it("keeps an offline tap pending and counted", async () => {
    const { deps, rendered, getPending } = makeDeps({
      logDrink: vi.fn().mockRejectedValue(new TypeError("Network request failed")),
    });

    await handleAndroidTap(deps);

    expect(getPending()).toHaveLength(1);
    expect(rendered.at(-1)).toMatchObject({
      drinkCount: 3,
      beerCount: 3,
      pendingCount: 1,
    });
  });

  it("asks to open the app when the session is gone", async () => {
    const { deps, rendered, getPending } = makeDeps({
      logDrink: vi.fn().mockRejectedValue(new AuthRequiredError("no session")),
    });

    await handleAndroidTap(deps);

    expect(getPending()).toHaveLength(1);
    expect(rendered.at(-1)?.message).toBe("openAppToSync");
  });

  it("drops a rejected tap and ends when the festival is over", async () => {
    const { deps, getPending } = makeDeps({
      logDrink: vi.fn().mockRejectedValue(new ApiError("DATE_OUTSIDE_FESTIVAL", "outside", 400)),
    });

    await handleAndroidTap(deps);

    expect(getPending()).toEqual([]);
    expect(deps.surface.end).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), {
      status: 400,
      code: "DATE_OUTSIDE_FESTIVAL",
    });
  });

  it("never logs onto yesterday after midnight in the festival's timezone", async () => {
    const { deps } = makeDeps({
      now: () => new Date("2026-10-03T22:30:00.000Z"),
    }); // 00:30 Oct 4 in Berlin

    await handleAndroidTap(deps);

    expect(deps.logDrink).not.toHaveBeenCalled();
    expect(deps.surface.end).toHaveBeenCalled();
  });

  it("keeps the tap pending on a 429", async () => {
    const { deps, getPending } = makeDeps({
      logDrink: vi.fn().mockRejectedValue(new ApiError("RATE_LIMITED", "slow down", 429)),
    });

    await handleAndroidTap(deps);

    expect(getPending()).toHaveLength(1);
  });

  it("handles rapid taps one at a time, oldest first", async () => {
    const order: string[] = [];
    const { deps } = makeDeps({
      logDrink: vi.fn(async (tap: PendingTap) => {
        order.push(tap.consumptionId);
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { drinkCount: 2 + order.length, beerCount: 2 + order.length };
      }),
    });

    await Promise.all([handleAndroidTap(deps), handleAndroidTap(deps), handleAndroidTap(deps)]);

    expect(order).toEqual(["id-1", "id-2", "id-3"]);
  });
});

describe("accounts", () => {
  it("tags a tap with the session's user", async () => {
    const { deps } = makeDeps();

    await handleAndroidTap(deps);

    expect(deps.logDrink).toHaveBeenCalledWith(expect.objectContaining({ userId: USER }));
  });

  it("falls back to the surface's owner when the task has no session", async () => {
    const { deps, getPending } = makeDeps({
      currentUserId: vi.fn().mockResolvedValue(null),
      logDrink: vi.fn().mockRejectedValue(new AuthRequiredError("no session")),
    });
    const surface = await deps.surface.read();
    vi.mocked(deps.surface.read).mockResolvedValue({ ...surface!, userId: "owner" });

    await handleAndroidTap(deps);

    expect(getPending()).toEqual([expect.objectContaining({ userId: "owner" })]);
  });

  it("asks to open the app instead of queuing a tap nobody owns", async () => {
    const { deps, rendered, getPending } = makeDeps({
      currentUserId: vi.fn().mockResolvedValue(null),
    });

    await handleAndroidTap(deps);

    expect(getPending()).toEqual([]);
    expect(rendered.at(-1)).toMatchObject({ drinkCount: 2, message: "openAppToSync" });
  });

  it("drops another account's queued tap without sending it", async () => {
    const { deps, getPending } = makeDeps();
    await deps.surface.appendPending({
      userId: "user-b",
      consumptionId: "theirs",
      festivalId: "123e4567-e89b-12d3-a456-426614174000",
      date: "2026-10-03",
      drinkType: "beer",
      tentId: null,
      tappedAt: "2026-10-03T10:30:00.000Z",
    });

    await applyServerState(deps, baseState);

    expect(deps.logDrink).not.toHaveBeenCalled();
    expect(getPending()).toEqual([]);
  });
});

describe("serialization", () => {
  it("sends a tap exactly once when a server push lands mid-tap", async () => {
    const { deps, getPending } = makeDeps({
      logDrink: vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { drinkCount: 3, beerCount: 3 };
      }),
    });

    await Promise.all([handleAndroidTap(deps), applyServerState(deps, baseState)]);

    expect(deps.logDrink).toHaveBeenCalledTimes(1);
    expect(getPending()).toEqual([]);
  });

  it("surfaces a failure to the caller and keeps the chain alive", async () => {
    const { deps } = makeDeps();
    (deps.surface.render as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("render failed"),
    );

    await expect(handleAndroidTap(deps)).rejects.toThrow("render failed");
    await handleAndroidTap(deps);

    expect(deps.logDrink).toHaveBeenCalled();
  });

  it("keeps festivalEnded over a later failure", async () => {
    const { deps } = makeDeps({
      logDrink: vi
        .fn()
        .mockRejectedValueOnce(new ApiError("DATE_OUTSIDE_FESTIVAL", "outside", 400))
        .mockRejectedValue(new AuthRequiredError("no session")),
    });
    await deps.surface.appendPending({
      userId: USER,
      consumptionId: "p1",
      festivalId: "123e4567-e89b-12d3-a456-426614174000",
      date: "2026-10-03",
      drinkType: "beer",
      tentId: null,
      tappedAt: "2026-10-03T10:30:00.000Z",
    });
    await deps.surface.appendPending({
      userId: USER,
      consumptionId: "p2",
      festivalId: "123e4567-e89b-12d3-a456-426614174000",
      date: "2026-10-03",
      drinkType: "beer",
      tentId: null,
      tappedAt: "2026-10-03T10:31:00.000Z",
    });

    await applyServerState(deps, baseState);

    expect(deps.surface.end).toHaveBeenCalled();
  });
});

describe("push ordering", () => {
  function withAppliedAt(deps: AndroidTapDeps, appliedAt: number) {
    const read = deps.surface.read as ReturnType<typeof vi.fn>;
    read.mockImplementation(async () => ({
      attributes: {
        festivalId: "123e4567-e89b-12d3-a456-426614174000",
        festivalName: "Oktoberfest 2026",
        date: "2026-10-03",
        timezone: "Europe/Berlin",
        apiBaseUrl: "http://localhost:3008/api/v1",
      },
      state: baseState,
      labels: {} as never,
      userId: USER,
      appliedAt,
    }));
  }

  it("drops a push older than what is shown", async () => {
    const { deps } = makeDeps();
    withAppliedAt(deps, 2_000);

    await applyServerState(deps, { ...baseState, drinkCount: 1 }, 1_000);
    await applyServerState(deps, null, 1_500);

    expect(deps.surface.render).not.toHaveBeenCalled();
    expect(deps.surface.end).not.toHaveBeenCalled();
  });

  it("applies a newer push and remembers its time", async () => {
    const { deps } = makeDeps();
    withAppliedAt(deps, 2_000);

    await applyServerState(deps, { ...baseState, drinkCount: 7 }, 3_000);

    expect(deps.surface.render).toHaveBeenLastCalledWith(
      expect.objectContaining({ drinkCount: 7 }),
      3_000,
    );
  });

  it("ignores a push meant for another account", async () => {
    const { deps } = makeDeps();
    withAppliedAt(deps, 2_000);

    await applyServerState(deps, { ...baseState, drinkCount: 7 }, 3_000, "someone-else");

    expect(deps.surface.render).not.toHaveBeenCalled();
  });
});

describe("applyServerState", () => {
  it("ends the notification when the server says the day is empty", async () => {
    const { deps } = makeDeps();

    await applyServerState(deps, null);

    expect(deps.surface.end).toHaveBeenCalled();
  });

  it("adds still-pending taps on top of the server's count", async () => {
    const { deps, rendered } = makeDeps({
      logDrink: vi.fn().mockRejectedValue(new TypeError("Network request failed")),
    });
    await deps.surface.appendPending({
      userId: USER,
      consumptionId: "p1",
      festivalId: "123e4567-e89b-12d3-a456-426614174000",
      date: "2026-10-03",
      drinkType: "beer",
      tentId: null,
      tappedAt: "2026-10-03T10:30:00.000Z",
    });

    await applyServerState(deps, { ...baseState, drinkCount: 5, beerCount: 5 });

    expect(rendered.at(-1)).toMatchObject({
      drinkCount: 6,
      beerCount: 6,
      pendingCount: 1,
    });
  });

  it("does not let an older-day pending tap overwrite today's totals", async () => {
    const { deps, rendered, getPending } = makeDeps({
      logDrink: vi.fn().mockResolvedValue({ drinkCount: 99, beerCount: 99 }),
    });
    await deps.surface.appendPending({
      userId: USER,
      consumptionId: "old",
      festivalId: "123e4567-e89b-12d3-a456-426614174000",
      date: "2026-10-02",
      drinkType: "beer",
      tentId: null,
      tappedAt: "2026-10-02T10:30:00.000Z",
    });

    await applyServerState(deps, { ...baseState, drinkCount: 5, beerCount: 5 });

    expect(deps.logDrink).toHaveBeenCalledTimes(1);
    expect(getPending()).toEqual([]);
    expect(rendered.at(-1)).toMatchObject({
      drinkCount: 5,
      beerCount: 5,
      pendingCount: 0,
    });
  });
});
