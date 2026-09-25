import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationService } from "../notification.service";

const { triggerMock, countMock } = vi.hoisted(() => ({
  triggerMock: vi.fn(),
  countMock: vi.fn(),
}));

vi.mock("@novu/api", () => ({
  Novu: class {
    trigger = triggerMock;
    subscribers = { notifications: { count: countMock } };
  },
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

function mockSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })),
  } as unknown as SupabaseClient<Database>;
}

async function unlockAchievement() {
  const service = new NotificationService(mockSupabase(), "test-key");
  await service.notifyAchievementUnlocked(USER_ID, {
    achievementName: "First Mass",
    tier: 1,
    slug: "first-mass",
  });
}

describe("iOS badge on push", () => {
  beforeEach(() => {
    triggerMock.mockReset().mockResolvedValue({});
    countMock.mockReset();
  });

  it("sends the unread count including the new notification", async () => {
    countMock.mockResolvedValue({ result: [{ count: 2 }] });

    await unlockAchievement();

    expect(countMock).toHaveBeenCalledWith(USER_ID, JSON.stringify([{ read: false }]));
    expect(triggerMock.mock.calls[0][0].overrides).toEqual({
      providers: { expo: { badge: 3 } },
    });
  });

  it("still delivers the notification when the count lookup fails", async () => {
    countMock.mockRejectedValue(new Error("Novu down"));

    await unlockAchievement();

    expect(triggerMock).toHaveBeenCalledOnce();
    expect(triggerMock.mock.calls[0][0].overrides).toBeUndefined();
  });
});
