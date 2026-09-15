import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { NotificationService } from "@/lib/services/notifications";

import { processFestivalOpeningNotifications } from "./festival-opening";

const oktoberfest = {
  id: "fest-okt-2026",
  name: "Oktoberfest 2026",
  start_date: "2026-09-19",
  timezone: "Europe/Berlin",
};

function createMockSupabase(options: {
  festivals: (typeof oktoberfest)[];
  users: { id: string; email_confirmed_at: string | null }[];
  optedOutUserIds?: string[];
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "festivals") {
        return {
          select: vi.fn().mockResolvedValue({ data: options.festivals, error: null }),
        };
      }
      if (table === "user_notification_preferences") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: (options.optedOutUserIds ?? []).map((userId) => ({ user_id: userId })),
              error: null,
            }),
          }),
        };
      }
      return {};
    }),
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users: options.users }, error: null }),
      },
    },
  };
}

function createMockNotifications() {
  return {
    notifyFestivalOpening: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService & { notifyFestivalOpening: ReturnType<typeof vi.fn> };
}

const confirmed = "2026-01-01T00:00:00Z";

describe("processFestivalOpeningNotifications", () => {
  it("does nothing when no festival opens today in its timezone", async () => {
    const supabase = createMockSupabase({
      festivals: [oktoberfest],
      users: [{ id: "u1", email_confirmed_at: confirmed }],
    });
    const notifications = createMockNotifications();

    await processFestivalOpeningNotifications(
      supabase as unknown as SupabaseClient<Database>,
      notifications,
      new Date("2026-09-18T09:00:00Z"),
    );

    expect(notifications.notifyFestivalOpening).not.toHaveBeenCalled();
  });

  it("notifies confirmed users who did not turn reminders off", async () => {
    const supabase = createMockSupabase({
      festivals: [oktoberfest],
      users: [
        { id: "u1", email_confirmed_at: confirmed },
        { id: "u2", email_confirmed_at: null },
        { id: "u3", email_confirmed_at: confirmed },
      ],
      optedOutUserIds: ["u3"],
    });
    const notifications = createMockNotifications();

    await processFestivalOpeningNotifications(
      supabase as unknown as SupabaseClient<Database>,
      notifications,
      new Date("2026-09-19T09:15:00Z"), // 11:15 in Munich
    );

    expect(notifications.notifyFestivalOpening).toHaveBeenCalledTimes(1);
    expect(notifications.notifyFestivalOpening).toHaveBeenCalledWith(["u1"], {
      id: "fest-okt-2026",
      name: "Oktoberfest 2026",
    });
  });

  it("uses the festival's local date, not UTC", async () => {
    const supabase = createMockSupabase({
      festivals: [oktoberfest],
      users: [{ id: "u1", email_confirmed_at: confirmed }],
    });
    const notifications = createMockNotifications();

    await processFestivalOpeningNotifications(
      supabase as unknown as SupabaseClient<Database>,
      notifications,
      new Date("2026-09-18T22:30:00Z"), // 00:30 on 19 Sep in Munich
    );

    expect(notifications.notifyFestivalOpening).toHaveBeenCalledTimes(1);
  });
});

describe("NotificationService.notifyFestivalOpening", () => {
  it("bulk-triggers in chunks of 100 with a stable per-user transactionId", async () => {
    vi.stubEnv("NOVU_API_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const { NotificationService } = await import("@/lib/services/notifications");
    const service = new NotificationService();
    const triggerBulk = vi.fn().mockResolvedValue({});
    (service.novu as unknown as { triggerBulk: typeof triggerBulk }).triggerBulk = triggerBulk;

    const recipientIds = Array.from({ length: 150 }, (_, index) => `user-${index}`);
    await service.notifyFestivalOpening(recipientIds, { id: "fest-1", name: "Oktoberfest 2026" });

    expect(triggerBulk).toHaveBeenCalledTimes(2);
    const firstEvents = triggerBulk.mock.calls[0][0].events;
    const secondEvents = triggerBulk.mock.calls[1][0].events;
    expect(firstEvents).toHaveLength(100);
    expect(secondEvents).toHaveLength(50);
    expect(firstEvents[0]).toMatchObject({
      workflowId: "festival-opening",
      to: "user-0",
      transactionId: "festival-opening:fest-1:user-0",
    });
    vi.unstubAllEnvs();
  });
});
