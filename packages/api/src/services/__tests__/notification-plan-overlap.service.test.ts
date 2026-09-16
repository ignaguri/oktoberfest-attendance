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
const MUTED_ID = "33333333-3333-4333-8333-333333333333";
const FESTIVAL_ID = "44444444-4444-4444-8444-444444444444";

const OVERLAP = {
  actorId: ACTOR_ID,
  festivalId: FESTIVAL_ID,
  date: "2026-09-26",
  today: "2026-09-23",
  kind: "plan" as const,
  tentName: null,
};

/** The service-role client: recipient lookup, preferences, and the dedupe ledger. */
function mockAdmin({
  recipients,
  prefs = [],
  inserted,
}: {
  recipients: string[];
  prefs?: Array<{ user_id: string; friend_plans_enabled: boolean | null }>;
  inserted: string[];
}) {
  const rpc = vi.fn().mockResolvedValue({ data: recipients, error: null });
  const ledgerSelect = vi
    .fn()
    .mockResolvedValue({ data: inserted.map((id) => ({ recipient_id: id })), error: null });
  const upsert = vi.fn().mockReturnValue({ select: ledgerSelect });
  const prefsIn = vi.fn().mockResolvedValue({ data: prefs, error: null });

  const client = {
    rpc,
    from: vi.fn((table: string) =>
      table === "user_notification_preferences"
        ? { select: vi.fn().mockReturnValue({ in: prefsIn }) }
        : { upsert },
    ),
  };
  vi.mocked(createAdminClient).mockReturnValue(client as never);

  return { rpc, upsert };
}

function mockRequestScopedSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { username: "ana", full_name: "Ana", avatar_url: null },
            error: null,
          }),
        }),
      }),
    })),
  } as unknown as SupabaseClient<Database>;
}

describe("NotificationService.notifyPlanOverlap", () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    triggerMock.mockResolvedValue({ result: {} });
    service = new NotificationService(mockRequestScopedSupabase(), "test-novu-key");
  });

  it("tells a friend who marked the same day", async () => {
    const { rpc } = mockAdmin({ recipients: [FRIEND_ID], inserted: [FRIEND_ID] });

    await service.notifyPlanOverlap(OVERLAP);

    expect(rpc).toHaveBeenCalledWith("get_day_plan_overlap_recipients", {
      p_actor_id: ACTOR_ID,
      p_festival_id: FESTIVAL_ID,
      p_date: "2026-09-26",
    });
    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "friend-plan-overlap",
        to: FRIEND_ID,
        payload: expect.objectContaining({
          type: "friend-plan-overlap",
          date: "2026-09-26",
          kind: "plan",
          actorName: "ana",
          body: "ana is going on Saturday too",
        }),
      }),
    );
  });

  it("skips a recipient who turned friend plans off", async () => {
    const { upsert } = mockAdmin({
      recipients: [FRIEND_ID, MUTED_ID],
      prefs: [{ user_id: MUTED_ID, friend_plans_enabled: false }],
      inserted: [FRIEND_ID],
    });

    await service.notifyPlanOverlap(OVERLAP);

    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ recipient_id: FRIEND_ID, actor_id: ACTOR_ID })],
      expect.objectContaining({ ignoreDuplicates: true }),
    );
    expect(triggerMock.mock.calls.map(([call]) => call.to)).toEqual([FRIEND_ID]);
  });

  it("does not repeat a notification the ledger already holds", async () => {
    mockAdmin({ recipients: [FRIEND_ID], inserted: [] });

    await service.notifyPlanOverlap(OVERLAP);

    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("sends nothing when nobody else marked the day", async () => {
    const { upsert } = mockAdmin({ recipients: [], inserted: [] });

    await service.notifyPlanOverlap(OVERLAP);

    expect(upsert).not.toHaveBeenCalled();
    expect(triggerMock).not.toHaveBeenCalled();
  });
});
