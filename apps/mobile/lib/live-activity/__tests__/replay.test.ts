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

import { replayPendingTaps } from "../replay";

const USER = "user-a";

const tapFor = (id: string, userId = USER): PendingTap => ({
  userId,
  consumptionId: id,
  festivalId: "123e4567-e89b-12d3-a456-426614174000",
  date: "2026-10-03",
  drinkType: "beer",
  tentId: null,
  tappedAt: "2026-10-03T10:00:00.000Z",
});

describe("replayPendingTaps", () => {
  it("sends every tap with its own id and removes the sent ones", async () => {
    const remove = vi.fn();
    const logDrink = vi.fn().mockResolvedValue({});

    const result = await replayPendingTaps({
      userId: USER,
      peek: async () => [tapFor("a"), tapFor("b")],
      remove,
      logDrink,
    });

    expect(logDrink).toHaveBeenNthCalledWith(1, tapFor("a"));
    expect(logDrink).toHaveBeenNthCalledWith(2, tapFor("b"));
    expect(remove).toHaveBeenCalledWith(["a", "b"]);
    expect(result).toEqual({ sent: 2, dropped: 0, kept: 0 });
  });

  it("treats a replay of an already stored drink as sent", async () => {
    const remove = vi.fn();
    // The server returns 200 for a consumptionId it already has.
    const result = await replayPendingTaps({
      userId: USER,
      peek: async () => [tapFor("a")],
      remove,
      logDrink: vi.fn().mockResolvedValue({ drinkCount: 1 }),
    });

    expect(remove).toHaveBeenCalledWith(["a"]);
    expect(result.sent).toBe(1);
  });

  it("stops at a network error and keeps the rest", async () => {
    const remove = vi.fn();
    const result = await replayPendingTaps({
      userId: USER,
      peek: async () => [tapFor("a"), tapFor("b")],
      remove,
      logDrink: vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new TypeError("offline")),
    });

    expect(remove).toHaveBeenCalledWith(["a"]);
    expect(result).toEqual({ sent: 1, dropped: 0, kept: 1 });
  });

  it("drops taps the server rejects and stops without a session", async () => {
    const remove = vi.fn();
    const result = await replayPendingTaps({
      userId: USER,
      peek: async () => [tapFor("a"), tapFor("b"), tapFor("c")],
      remove,
      logDrink: vi
        .fn()
        .mockRejectedValueOnce(new ApiError("DATE_OUTSIDE_FESTIVAL", "x", 400))
        .mockRejectedValueOnce(new AuthRequiredError("no session")),
    });

    expect(remove).toHaveBeenCalledWith(["a"]);
    expect(result).toEqual({ sent: 0, dropped: 1, kept: 2 });
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), {
      status: 400,
      code: "DATE_OUTSIDE_FESTIVAL",
    });
  });

  it("keeps a rate-limited tap and stops", async () => {
    const remove = vi.fn();
    const result = await replayPendingTaps({
      userId: USER,
      peek: async () => [tapFor("a"), tapFor("b")],
      remove,
      logDrink: vi.fn().mockRejectedValueOnce(new ApiError("RATE_LIMITED", "x", 429)),
    });

    expect(remove).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, dropped: 0, kept: 2 });
  });

  it("drops taps another account queued, and untagged ones, without sending them", async () => {
    const remove = vi.fn();
    const logDrink = vi.fn().mockResolvedValue({});

    const result = await replayPendingTaps({
      userId: USER,
      peek: async () => [tapFor("mine"), tapFor("theirs", "user-b"), { ...tapFor("old"), userId: undefined }],
      remove,
      logDrink,
    });

    expect(logDrink).toHaveBeenCalledTimes(1);
    expect(logDrink).toHaveBeenCalledWith(tapFor("mine"));
    expect(remove).toHaveBeenCalledWith(["theirs", "old", "mine"]);
    expect(result).toEqual({ sent: 1, dropped: 2, kept: 0 });
  });
});
