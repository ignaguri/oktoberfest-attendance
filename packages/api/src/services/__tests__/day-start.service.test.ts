import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "../../utils/admin-client";
import { NotificationService } from "../notification.service";

const { triggerMock } = vi.hoisted(() => ({ triggerMock: vi.fn() }));

vi.mock("@novu/api", () => ({
  Novu: class {
    trigger = triggerMock;
  },
}));

vi.mock("../../utils/admin-client", () => ({
  createAdminClient: vi.fn(),
}));

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const FRIEND_ID = "22222222-2222-4222-8222-222222222222";
const OPTED_OUT_ID = "33333333-3333-4333-8333-333333333333";
const FESTIVAL_ID = "44444444-4444-4444-8444-444444444444";
const DATE = "2026-09-22";

type PrefsRow = { user_id: string; day_start_enabled?: boolean | null };

/**
 * The admin client serves three calls in notifyDayStart: the ledger claim, the
 * recipient RPC, and the preference read. `claimed` drives whether this call is
 * treated as the one that started the day.
 */
function mockAdminClient(options: {
  claimed: boolean;
  recipients: string[];
  prefs: PrefsRow[];
}) {
  const client = {
    from: vi.fn((table: string) => {
      if (table === "day_start_notifications") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi
              .fn()
              .mockResolvedValue({
                data: options.claimed ? [{ actor_id: ACTOR_ID }] : [],
                error: null,
              }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: options.prefs, error: null }),
        }),
      };
    }),
    rpc: vi.fn().mockResolvedValue({ data: options.recipients, error: null }),
  };
  vi.mocked(createAdminClient).mockReturnValue(client as never);
  return client;
}

/** The actor's profile is read through the request-scoped client. */
function mockRequestScopedSupabase() {
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

describe("NotificationService.notifyDayStart", () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    triggerMock.mockResolvedValue({ result: {} });
    service = new NotificationService(mockRequestScopedSupabase(), "test-novu-key");
  });

  it("notifies friends and group-mates when it claims the day", async () => {
    mockAdminClient({ claimed: true, recipients: [FRIEND_ID], prefs: [] });

    const claimed = await service.notifyDayStart({
      actorId: ACTOR_ID,
      festivalId: FESTIVAL_ID,
      date: DATE,
      kind: "drink",
      tentName: "Hofbräu",
    });

    expect(claimed).toBe(true);
    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "day-start",
        to: FRIEND_ID,
        payload: expect.objectContaining({
          actorName: "nacho",
          kind: "drink",
          tentName: "Hofbräu",
        }),
      }),
    );
  });

  it("sends nothing and reports false when the day was already claimed", async () => {
    mockAdminClient({ claimed: false, recipients: [FRIEND_ID], prefs: [] });

    const claimed = await service.notifyDayStart({
      actorId: ACTOR_ID,
      festivalId: FESTIVAL_ID,
      date: DATE,
      kind: "checkin",
      tentName: "Augustiner",
    });

    expect(claimed).toBe(false);
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("drops recipients who switched day-start off", async () => {
    mockAdminClient({
      claimed: true,
      recipients: [FRIEND_ID, OPTED_OUT_ID],
      prefs: [{ user_id: OPTED_OUT_ID, day_start_enabled: false }],
    });

    await service.notifyDayStart({
      actorId: ACTOR_ID,
      festivalId: FESTIVAL_ID,
      date: DATE,
      kind: "drink",
      tentName: null,
    });

    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: FRIEND_ID,
        payload: expect.objectContaining({ tentName: "" }),
      }),
    );
  });

  it("reports false when the admin client is unavailable, so the caller falls back", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("no service role key");
    });

    const claimed = await service.notifyDayStart({
      actorId: ACTOR_ID,
      festivalId: FESTIVAL_ID,
      date: DATE,
      kind: "drink",
      tentName: null,
    });

    expect(claimed).toBe(false);
    expect(triggerMock).not.toHaveBeenCalled();
  });
});
