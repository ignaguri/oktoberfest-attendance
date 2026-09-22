import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const FRIEND_ID_2 = "55555555-5555-4555-8555-555555555555";
const DATE = "2026-09-22";

type PrefsRow = { user_id: string; day_start_enabled?: boolean | null };

/**
 * The admin client serves three calls in notifyDayStart: the ledger claim, the
 * recipient RPC, and the preference read. `claimed` drives whether this call is
 * treated as the one that started the day.
 */
function mockAdminClient(options: { claimed: boolean; recipients: string[]; prefs: PrefsRow[] }) {
  const client = {
    from: vi.fn((table: string) => {
      if (table === "day_start_notifications") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
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

/**
 * The actor's profile and the festival's timezone are both read through the
 * request-scoped client (profiles for the actor name, festivals for the
 * recency check). Table-aware so one mock can serve both queries.
 */
function mockRequestScopedSupabase(options?: { timezone?: string; profileError?: boolean }) {
  const timezone = options?.timezone ?? "UTC";
  return {
    from: vi.fn((table: string) => {
      if (table === "festivals") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { timezone }, error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(
              options?.profileError
                ? { data: null, error: new Error("profile read failed") }
                : {
                    data: { username: "nacho", full_name: "Nacho", avatar_url: null },
                    error: null,
                  },
            ),
          }),
        }),
      };
    }),
  } as unknown as SupabaseClient<Database>;
}

// "Now" is pinned so DATE ("2026-09-22") reliably reads as today and dates
// like "2026-09-21"/"2026-09-01" reliably read as yesterday/well-in-the-past,
// in the mocked festival's UTC timezone, regardless of when the suite runs.
const FAKE_NOW = new Date("2026-09-22T12:00:00.000Z");

describe("NotificationService.notifyDayStart", () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FAKE_NOW);
    triggerMock.mockResolvedValue({ result: {} });
    service = new NotificationService(mockRequestScopedSupabase(), "test-novu-key");
  });

  afterEach(() => {
    vi.useRealTimers();
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

  // The critical fix: a backfilled date well in the past must never claim the
  // ledger or announce, however both clients let a user pick any past date.
  it("does not claim the ledger or announce for a date older than yesterday", async () => {
    const client = mockAdminClient({ claimed: true, recipients: [FRIEND_ID], prefs: [] });

    const claimed = await service.notifyDayStart({
      actorId: ACTOR_ID,
      festivalId: FESTIVAL_ID,
      date: "2026-09-01", // "now" is faked to 2026-09-22
      kind: "drink",
      tentName: null,
    });

    expect(claimed).toBe(false);
    expect(triggerMock).not.toHaveBeenCalled();
    // The recency check must run before the ledger claim, not just before the
    // fan-out: the ledger row must never be touched for a stale date.
    expect(client.from).not.toHaveBeenCalledWith("day_start_notifications");
  });

  // The window is today-or-yesterday, not today-only: an offline-queue push
  // for a visit near midnight festival-time can land after the server has
  // already rolled to the next day. Yesterday in the festival's own timezone
  // must still announce.
  it("still announces for yesterday in the festival's timezone", async () => {
    mockAdminClient({ claimed: true, recipients: [FRIEND_ID], prefs: [] });

    const claimed = await service.notifyDayStart({
      actorId: ACTOR_ID,
      festivalId: FESTIVAL_ID,
      date: "2026-09-21", // yesterday relative to the faked "now"
      kind: "checkin",
      tentName: null,
    });

    expect(claimed).toBe(true);
    expect(triggerMock).toHaveBeenCalledTimes(1);
  });

  // Pins current behaviour rather than endorsing it: when every recipient has
  // day-start disabled, notifyDayStart still reports success, which suppresses
  // the caller's tent check-in fallback. A group-mate who wants check-ins but
  // not day-starts gets nothing for this action. Flagged in the fix-wave
  // report as a follow-up, not fixed here.
  it("reports success even when every recipient has day-start disabled", async () => {
    mockAdminClient({
      claimed: true,
      recipients: [OPTED_OUT_ID],
      prefs: [{ user_id: OPTED_OUT_ID, day_start_enabled: false }],
    });

    const claimed = await service.notifyDayStart({
      actorId: ACTOR_ID,
      festivalId: FESTIVAL_ID,
      date: DATE,
      kind: "checkin",
      tentName: null,
    });

    expect(claimed).toBe(true);
    expect(triggerMock).not.toHaveBeenCalled();
  });

  // Fix 2: a fully-failed fan-out must not report success. announceCheckIn
  // reads `true` as "handled" and skips the tent check-in fallback, and the
  // day-start Novu workflow does not exist in production yet, so every
  // trigger call rejects there today. Reverting to a bare `return true`
  // would leave this exact gap live.
  it("reports false when every trigger rejects", async () => {
    mockAdminClient({ claimed: true, recipients: [FRIEND_ID], prefs: [] });
    triggerMock.mockRejectedValue(new Error("workflow not found"));

    const claimed = await service.notifyDayStart({
      actorId: ACTOR_ID,
      festivalId: FESTIVAL_ID,
      date: DATE,
      kind: "checkin",
      tentName: null,
    });

    expect(claimed).toBe(false);
  });

  // The other side of the same boundary: one real push among failures still
  // counts as handled, so the caller must not also run the check-in
  // fallback and double-notify.
  it("reports true when at least one trigger succeeds among failures", async () => {
    mockAdminClient({ claimed: true, recipients: [FRIEND_ID, FRIEND_ID_2], prefs: [] });
    triggerMock.mockRejectedValueOnce(new Error("workflow not found"));
    triggerMock.mockResolvedValueOnce({ result: {} });

    const claimed = await service.notifyDayStart({
      actorId: ACTOR_ID,
      festivalId: FESTIVAL_ID,
      date: DATE,
      kind: "checkin",
      tentName: null,
    });

    expect(claimed).toBe(true);
    expect(triggerMock).toHaveBeenCalledTimes(2);
  });

  // Every bail-out after the claim has the same shape: the ledger row is
  // spent, nothing was pushed, so the caller has to hear `false` and run its
  // ordinary notification. Reporting `true` here would silence the day
  // entirely.
  it("reports false when the recipient lookup fails", async () => {
    const client = mockAdminClient({ claimed: true, recipients: [], prefs: [] });
    client.rpc.mockResolvedValue({ data: null, error: new Error("rpc exploded") });

    const claimed = await service.notifyDayStart({
      actorId: ACTOR_ID,
      festivalId: FESTIVAL_ID,
      date: DATE,
      kind: "checkin",
      tentName: null,
    });

    expect(claimed).toBe(false);
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it("reports false when the actor profile cannot be read", async () => {
    service = new NotificationService(
      mockRequestScopedSupabase({ profileError: true }),
      "test-novu-key",
    );
    mockAdminClient({ claimed: true, recipients: [FRIEND_ID], prefs: [] });

    const claimed = await service.notifyDayStart({
      actorId: ACTOR_ID,
      festivalId: FESTIVAL_ID,
      date: DATE,
      kind: "checkin",
      tentName: null,
    });

    expect(claimed).toBe(false);
    expect(triggerMock).not.toHaveBeenCalled();
  });
});
