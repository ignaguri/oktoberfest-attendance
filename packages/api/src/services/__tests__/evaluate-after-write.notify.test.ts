import type { PersistedUnlock } from "@prostcounter/shared/achievements";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { evaluateAfterWrite } from "../evaluate-after-write";

const { evaluateAndUnlockMock, notifyAchievementUnlockedMock } = vi.hoisted(() => ({
  evaluateAndUnlockMock: vi.fn(),
  notifyAchievementUnlockedMock: vi.fn(),
}));

vi.mock("../achievement.service", () => ({
  AchievementService: class {
    evaluateAndUnlock = evaluateAndUnlockMock;
  },
}));

vi.mock("../notification.service", () => ({
  NotificationService: class {
    notifyAchievementUnlocked = notifyAchievementUnlockedMock;
  },
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const FESTIVAL_ID = "22222222-2222-4222-8222-222222222222";

const UNLOCK: PersistedUnlock = {
  slug: "drinks_day_max.t2",
  seriesId: "drinks_day_max",
  tier: 2,
  category: "drinking",
  scope: "festival",
  glyph: "beer",
  points: 20,
  eventId: "33333333-3333-4333-8333-333333333333",
};

function fakeSupabase() {
  return {} as unknown as SupabaseClient;
}

describe("evaluateAfterWrite notification wiring", () => {
  const originalNovuKey = process.env.NOVU_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOVU_API_KEY = "test-novu-key";
  });

  afterEach(() => {
    process.env.NOVU_API_KEY = originalNovuKey;
  });

  it("notifies the achiever for every unlock the write produced", async () => {
    evaluateAndUnlockMock.mockResolvedValue([UNLOCK]);

    const result = await evaluateAfterWrite(fakeSupabase(), USER_ID, FESTIVAL_ID, "test-context");

    expect(result).toEqual([UNLOCK]);
    expect(notifyAchievementUnlockedMock).toHaveBeenCalledTimes(1);
    expect(notifyAchievementUnlockedMock).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ tier: 2, slug: "drinks_day_max.t2" }),
    );
  });

  it("skips notifying when NOVU_API_KEY is not configured", async () => {
    delete process.env.NOVU_API_KEY;
    evaluateAndUnlockMock.mockResolvedValue([UNLOCK]);

    await evaluateAfterWrite(fakeSupabase(), USER_ID, FESTIVAL_ID, "test-context");

    expect(notifyAchievementUnlockedMock).not.toHaveBeenCalled();
  });

  it("does not notify when there is nothing unlocked", async () => {
    evaluateAndUnlockMock.mockResolvedValue([]);

    await evaluateAfterWrite(fakeSupabase(), USER_ID, FESTIVAL_ID, "test-context");

    expect(notifyAchievementUnlockedMock).not.toHaveBeenCalled();
  });

  it("still returns the unlocks when notifying throws", async () => {
    evaluateAndUnlockMock.mockResolvedValue([UNLOCK]);
    notifyAchievementUnlockedMock.mockRejectedValue(new Error("novu is down"));

    const result = await evaluateAfterWrite(fakeSupabase(), USER_ID, FESTIVAL_ID, "test-context");

    expect(result).toEqual([UNLOCK]);
  });
});
