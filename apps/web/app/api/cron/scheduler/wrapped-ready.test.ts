import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NotificationService } from "@/lib/services/notifications";

import { processWrappedReadyNotifications } from "./wrapped-ready";

const oktoberfest = {
  id: "fest-okt-2026",
  name: "Oktoberfest 2026",
  end_date: "2026-10-04",
  timezone: "Europe/Berlin",
};

type Page = { data: Record<string, unknown>[] | null; error: unknown };

// Both paged queries use .select().eq().order().range(); each .range() call
// consumes the next page for that table, in order.
function createMockSupabase(options: {
  festivals: (typeof oktoberfest)[];
  attendancePages: Page[];
  optedOutPages?: Page[];
}) {
  const pagesByTable: Record<string, Page[]> = {
    attendances: options.attendancePages,
    user_notification_preferences: options.optedOutPages ?? [{ data: [], error: null }],
  };
  const pageIndexByTable: Record<string, number> = {};

  return {
    from: vi.fn((table: string) => {
      if (table === "festivals") {
        return { select: vi.fn().mockResolvedValue({ data: options.festivals, error: null }) };
      }
      const range = vi.fn().mockImplementation(() => {
        const index = pageIndexByTable[table] ?? 0;
        pageIndexByTable[table] = index + 1;
        return Promise.resolve(pagesByTable[table]?.[index] ?? { data: [], error: null });
      });
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ range }) }),
        }),
      };
    }),
  };
}

function createMockNotifications() {
  return {
    notifyWrappedReady: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService & { notifyWrappedReady: ReturnType<typeof vi.fn> };
}

function run(
  supabase: ReturnType<typeof createMockSupabase>,
  notifications: NotificationService,
  now: string,
) {
  return processWrappedReadyNotifications(
    supabase as unknown as SupabaseClient<Database>,
    notifications,
    new Date(now),
  );
}

const festivalRef = { id: "fest-okt-2026", name: "Oktoberfest 2026" };

describe("processWrappedReadyNotifications", () => {
  it("does nothing on the festival's last day", async () => {
    const supabase = createMockSupabase({
      festivals: [oktoberfest],
      attendancePages: [{ data: [{ user_id: "u1" }], error: null }],
    });
    const notifications = createMockNotifications();

    await run(supabase, notifications, "2026-10-04T09:00:00Z");

    expect(notifications.notifyWrappedReady).not.toHaveBeenCalled();
  });

  it("notifies each attendee once on unlock day, skipping opted-out users and null ids", async () => {
    const supabase = createMockSupabase({
      festivals: [oktoberfest],
      attendancePages: [
        {
          data: [{ user_id: "u1" }, { user_id: "u1" }, { user_id: null }, { user_id: "u2" }],
          error: null,
        },
      ],
      optedOutPages: [{ data: [{ user_id: "u2" }], error: null }],
    });
    const notifications = createMockNotifications();

    await run(supabase, notifications, "2026-10-05T09:00:00Z");

    expect(notifications.notifyWrappedReady).toHaveBeenCalledTimes(1);
    expect(notifications.notifyWrappedReady).toHaveBeenCalledWith(["u1"], festivalRef);
  });

  it("uses the festival's local date, not UTC", async () => {
    const supabase = createMockSupabase({
      festivals: [oktoberfest],
      attendancePages: [{ data: [{ user_id: "u1" }], error: null }],
    });
    const notifications = createMockNotifications();

    await run(supabase, notifications, "2026-10-04T22:30:00Z"); // 00:30 on 5 Oct in Munich

    expect(notifications.notifyWrappedReady).toHaveBeenCalledWith(["u1"], festivalRef);
  });

  it("reads attendees past the first page", async () => {
    const fullPage = Array.from({ length: 1000 }, (_, index) => ({ user_id: `filler-${index}` }));
    const supabase = createMockSupabase({
      festivals: [oktoberfest],
      attendancePages: [
        { data: fullPage, error: null },
        { data: [{ user_id: "late-user" }], error: null },
      ],
    });
    const notifications = createMockNotifications();

    await run(supabase, notifications, "2026-10-05T09:00:00Z");

    const recipientIds = notifications.notifyWrappedReady.mock.calls[0][0] as string[];
    expect(recipientIds).toHaveLength(1001);
    expect(recipientIds).toContain("late-user");
  });

  it("notifies nobody when preferences can't be read", async () => {
    const supabase = createMockSupabase({
      festivals: [oktoberfest],
      attendancePages: [{ data: [{ user_id: "u1" }], error: null }],
      optedOutPages: [{ data: null, error: { message: "boom" } }],
    });
    const notifications = createMockNotifications();

    await run(supabase, notifications, "2026-10-05T09:00:00Z");

    expect(notifications.notifyWrappedReady).not.toHaveBeenCalled();
  });

  it("still notifies later festivals when one send fails, then rejects", async () => {
    const otherFestival = { ...oktoberfest, id: "fest-other", name: "Other Fest" };
    const supabase = createMockSupabase({
      festivals: [oktoberfest, otherFestival],
      attendancePages: [
        { data: [{ user_id: "u1" }], error: null },
        { data: [{ user_id: "u2" }], error: null },
      ],
    });
    const notifications = createMockNotifications();
    notifications.notifyWrappedReady.mockRejectedValueOnce(new Error("novu unavailable"));

    await expect(run(supabase, notifications, "2026-10-05T09:00:00Z")).rejects.toThrow();
    expect(notifications.notifyWrappedReady).toHaveBeenCalledTimes(2);
    expect(notifications.notifyWrappedReady).toHaveBeenLastCalledWith(["u2"], {
      id: "fest-other",
      name: "Other Fest",
    });
  });

  it("does not call Novu when nobody qualifies", async () => {
    const supabase = createMockSupabase({
      festivals: [oktoberfest],
      attendancePages: [{ data: [], error: null }],
    });
    const notifications = createMockNotifications();

    await run(supabase, notifications, "2026-10-05T09:00:00Z");

    expect(notifications.notifyWrappedReady).not.toHaveBeenCalled();
  });
});

async function createServiceWithTriggerBulk(triggerBulk: ReturnType<typeof vi.fn>) {
  vi.stubEnv("NOVU_API_KEY", "test-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  const { NotificationService } = await import("@/lib/services/notifications");
  const service = new NotificationService();
  (service.novu as unknown as { triggerBulk: typeof triggerBulk }).triggerBulk = triggerBulk;
  return service;
}

describe("NotificationService.notifyWrappedReady", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("bulk-triggers in chunks of 100 with a stable per-user transactionId", async () => {
    const triggerBulk = vi.fn().mockResolvedValue({});
    const service = await createServiceWithTriggerBulk(triggerBulk);
    const recipientIds = Array.from({ length: 150 }, (_, index) => `user-${index}`);

    await service.notifyWrappedReady(recipientIds, { id: "fest-1", name: "Oktoberfest 2026" });

    expect(triggerBulk).toHaveBeenCalledTimes(2);
    expect(triggerBulk.mock.calls[0][0].events).toHaveLength(100);
    expect(triggerBulk.mock.calls[1][0].events).toHaveLength(50);
    expect(triggerBulk.mock.calls[0][0].events[0]).toMatchObject({
      workflowId: "wrapped-ready",
      to: "user-0",
      transactionId: "wrapped-ready:fest-1:user-0",
      payload: {
        type: "wrapped-ready",
        festivalId: "fest-1",
        festivalName: "Oktoberfest 2026",
        title: "Your Oktoberfest 2026 Wrapped is here 🍻",
      },
    });
  });

  it("attempts every chunk even when an earlier one fails, then rejects", async () => {
    const triggerBulk = vi
      .fn()
      .mockRejectedValueOnce(new Error("novu unavailable"))
      .mockResolvedValueOnce({});
    const service = await createServiceWithTriggerBulk(triggerBulk);
    const recipientIds = Array.from({ length: 150 }, (_, index) => `user-${index}`);

    await expect(
      service.notifyWrappedReady(recipientIds, { id: "fest-1", name: "Oktoberfest 2026" }),
    ).rejects.toThrow();
    expect(triggerBulk).toHaveBeenCalledTimes(2);
  });
});
