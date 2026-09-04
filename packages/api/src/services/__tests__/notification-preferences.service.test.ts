import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "../../utils/admin-client";
import { NotificationService } from "../notification.service";

// hoisted so the vi.mock factory below, which vitest lifts above the imports,
// can close over it.
const { triggerMock } = vi.hoisted(() => ({ triggerMock: vi.fn() }));

vi.mock("@novu/api", () => ({
  Novu: class {
    trigger = triggerMock;
  },
}));

vi.mock("../../utils/admin-client", () => ({
  createAdminClient: vi.fn(),
}));

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const JOINER_ID = "22222222-2222-4222-8222-222222222222";
const GROUP_ID = "33333333-3333-4333-8333-333333333333";

type PrefsRow = {
  user_id: string;
  group_notifications_enabled?: boolean | null;
  group_join_enabled?: boolean | null;
  checkin_enabled?: boolean | null;
};

/** Stands in for the service-role client the preference lookup must go through. */
function mockAdminClientReturning(rows: PrefsRow[]) {
  const inMock = vi.fn().mockResolvedValue({ data: rows, error: null });
  const client = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ in: inMock }),
    }),
  };
  vi.mocked(createAdminClient).mockReturnValue(client as never);
  return { client, inMock };
}

/**
 * notifyGroupJoin's own lookups (the group row and the joiner's profile) still
 * go through the request-scoped client; only the preference read is elevated.
 */
function mockRequestScopedSupabase() {
  return {
    from: vi.fn((table: string) => {
      const row =
        table === "groups"
          ? { name: "Wiesn Crew", created_by: ADMIN_ID }
          : { username: "joiner", full_name: "A Joiner", avatar_url: null };

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      };
    }),
  } as unknown as SupabaseClient<Database>;
}

describe("NotificationService recipient preferences", () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    triggerMock.mockResolvedValue({ result: {} });
    service = new NotificationService(mockRequestScopedSupabase(), "test-novu-key");
  });

  // The whole point of the helper: RLS on user_notification_preferences only
  // exposes the caller's own row, so the read has to be elevated or every
  // recipient silently disappears.
  it("reads recipient preferences through the admin client", async () => {
    const { client } = mockAdminClientReturning([]);

    await service.notifyGroupAchievement([JOINER_ID], {
      achieverName: "Someone",
      achievementName: "Maß Master",
      rarity: "rare",
    });

    expect(createAdminClient).toHaveBeenCalled();
    expect(client.from).toHaveBeenCalledWith("user_notification_preferences");
  });

  it("treats a recipient with no preferences row as opted in", async () => {
    mockAdminClientReturning([]);

    await service.notifyGroupAchievement([JOINER_ID], {
      achieverName: "Someone",
      achievementName: "Maß Master",
      rarity: "rare",
    });

    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock.mock.calls[0]![0]).toMatchObject({ to: JOINER_ID });
  });

  it("skips only the recipients who explicitly turned the toggle off", async () => {
    const optedOut = "44444444-4444-4444-8444-444444444444";
    mockAdminClientReturning([
      { user_id: optedOut, group_notifications_enabled: false },
      { user_id: JOINER_ID, group_notifications_enabled: true },
    ]);

    await service.notifyGroupAchievement([JOINER_ID, optedOut], {
      achieverName: "Someone",
      achievementName: "Maß Master",
      rarity: "rare",
    });

    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock.mock.calls[0]![0]).toMatchObject({ to: JOINER_ID });
  });

  // Regression: this read used to go through the request-scoped client, which
  // returned null for the admin, and the guard read null as "send anyway".
  it("honours group_join_enabled for the group admin", async () => {
    mockAdminClientReturning([{ user_id: ADMIN_ID, group_join_enabled: false }]);

    await service.notifyGroupJoin(GROUP_ID, JOINER_ID);

    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("notifies the group admin when they have not opted out", async () => {
    mockAdminClientReturning([{ user_id: ADMIN_ID, group_join_enabled: true }]);

    await service.notifyGroupJoin(GROUP_ID, JOINER_ID);

    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock.mock.calls[0]![0]).toMatchObject({ to: ADMIN_ID });
  });

  // Failing open here would notify people who opted out, so it sends nothing.
  it("sends nothing when preferences cannot be read at all", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("Supabase admin credentials not configured");
    });

    await service.notifyGroupAchievement([JOINER_ID], {
      achieverName: "Someone",
      achievementName: "Maß Master",
      rarity: "rare",
    });

    expect(triggerMock).not.toHaveBeenCalled();
  });
});
