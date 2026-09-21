import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationService } from "@/lib/services/notifications";

import { processReservationNotifications } from "./reservations";

type MockedSupabase = { rpc: any; from: any; __updates?: any[] };

function createMockSupabase(reminders: any[] = [], prompts: any[] = []) {
  const updates: any[] = [];
  const mock: MockedSupabase = {
    rpc: vi.fn((fn: string) => {
      if (fn === "rpc_due_reservation_reminders") return { data: reminders };
      if (fn === "rpc_due_reservation_prompts") return { data: prompts };
      return { data: null };
    }),
    from: vi.fn((table: string) => {
      if (table === "tents") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: reminders.concat(prompts).map((r) => ({ id: r.tent_id, name: "Tent" })),
            }),
          }),
        } as any;
      }
      if (table === "day_plans") {
        return {
          update: vi.fn((payload) => ({
            in: vi.fn((_, ids: string[]) => {
              updates.push({ payload, ids });
              return { data: null };
            }),
          })),
        } as any;
      }
      return {} as any;
    }),
    __updates: updates,
  } satisfies MockedSupabase;
  return mock;
}

function createMockNotifications() {
  return {
    notifyReservationReminder: vi.fn().mockResolvedValue(true),
    notifyReservationPrompt: vi.fn().mockResolvedValue(true),
  } as unknown as NotificationService;
}

function makeRow(id: string, userId: string, tentId: string) {
  return { id, user_id: userId, tent_id: tentId, start_at: new Date().toISOString() };
}

describe("processReservationNotifications", () => {
  beforeEach(() => vi.useRealTimers());

  it("sends reminders and marks reminder_sent_at", async () => {
    const reminder = {
      id: "r1",
      user_id: "u1",
      tent_id: "t1",
      start_at: new Date().toISOString(),
    };
    const supabase = createMockSupabase([reminder], []);
    const notifications = createMockNotifications();

    await processReservationNotifications(
      supabase as unknown as SupabaseClient<Database>,
      notifications,
      "http://localhost:3008",
      new Date().toISOString(),
    );

    expect((notifications as any).notifyReservationReminder).toHaveBeenCalledTimes(1);
    expect((supabase as any).__updates.length).toBeGreaterThan(0);
    expect((supabase as any).__updates[0].payload).toHaveProperty("reminder_sent_at");
  });

  it("sends prompts and marks prompt_sent_at", async () => {
    const prompt = {
      id: "p1",
      user_id: "u2",
      tent_id: "t2",
      start_at: new Date().toISOString(),
    };
    const supabase = createMockSupabase([], [prompt]);
    const notifications = createMockNotifications();

    await processReservationNotifications(
      supabase as unknown as SupabaseClient<Database>,
      notifications,
      "http://localhost:3008",
      new Date().toISOString(),
    );

    expect((notifications as any).notifyReservationPrompt).toHaveBeenCalledTimes(1);
    expect((supabase as any).__updates.length).toBeGreaterThan(0);
    expect((supabase as any).__updates.at(-1).payload).toHaveProperty("prompt_sent_at");
  });

  it("leaves prompt_sent_at unset when the notification failed", async () => {
    const supabase = createMockSupabase([], [makeRow("p1", "u2", "t2")]);
    const notifications = createMockNotifications();
    (notifications as any).notifyReservationPrompt.mockResolvedValue(false);

    await processReservationNotifications(
      supabase as unknown as SupabaseClient<Database>,
      notifications,
      "http://localhost:3008",
      new Date().toISOString(),
    );

    // Unstamped is what lets the next cron run retry it.
    expect((supabase as any).__updates).toHaveLength(0);
  });

  it("leaves reminder_sent_at unset when the notification failed", async () => {
    const supabase = createMockSupabase([makeRow("r1", "u1", "t1")], []);
    const notifications = createMockNotifications();
    (notifications as any).notifyReservationReminder.mockResolvedValue(false);

    await processReservationNotifications(
      supabase as unknown as SupabaseClient<Database>,
      notifications,
      "http://localhost:3008",
      new Date().toISOString(),
    );

    expect((supabase as any).__updates).toHaveLength(0);
  });

  it("stamps only the reservations that were delivered", async () => {
    const supabase = createMockSupabase(
      [],
      [makeRow("p1", "u1", "t1"), makeRow("p2", "u2", "t2"), makeRow("p3", "u3", "t3")],
    );
    const notifications = createMockNotifications();
    (notifications as any).notifyReservationPrompt
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await processReservationNotifications(
      supabase as unknown as SupabaseClient<Database>,
      notifications,
      "http://localhost:3008",
      new Date().toISOString(),
    );

    expect((supabase as any).__updates).toHaveLength(1);
    expect((supabase as any).__updates[0].ids).toEqual(["p1", "p3"]);
  });
});
