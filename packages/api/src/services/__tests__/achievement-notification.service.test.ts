import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationService } from "../notification.service";

const { triggerMock } = vi.hoisted(() => ({ triggerMock: vi.fn() }));

vi.mock("@novu/api", () => ({
  Novu: class {
    trigger = triggerMock;
  },
}));

vi.mock("../../utils/admin-client", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  })),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const MATE_ID = "22222222-2222-4222-8222-222222222222";

function mockSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { username: "nacho", full_name: "Nacho", avatar_url: null },
            error: null,
          }),
        }),
      }),
    })),
  } as unknown as SupabaseClient<Database>;
}

describe("achievement notifications", () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    triggerMock.mockResolvedValue({ result: {} });
    service = new NotificationService(mockSupabase(), "test-novu-key");
  });

  it("sends the unlock to the achiever with a tier, not a rarity", async () => {
    await service.notifyAchievementUnlocked(USER_ID, {
      achievementName: "Sechserpack",
      description: "Have 6 drinks in one day",
      tier: 2,
      slug: "drinks_day_max.t2",
    });

    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "achievement-unlocked",
        to: USER_ID,
        payload: expect.objectContaining({ achievementName: "Sechserpack", tier: 2 }),
      }),
    );
  });

  it("sends the group unlock to each recipient", async () => {
    await service.notifyGroupAchievement([MATE_ID], {
      achieverName: "Nacho",
      achievementName: "Zeltsammler",
      tier: 3,
    });

    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "group-achievement-unlocked",
        to: MATE_ID,
        payload: expect.objectContaining({ tier: 3 }),
      }),
    );
  });
});
