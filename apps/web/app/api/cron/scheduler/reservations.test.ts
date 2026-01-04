import { describe, it, expect, vi, beforeEach } from "vitest";

import type { NotificationService } from "@/lib/services/notifications";
import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";

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
              data: reminders
                .concat(prompts)
                .map((r) => ({ id: r.tent_id, name: "Tent" })),
            }),
          }),
        } as any;
      }
      if (table === "reservations") {
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
    notifyReservationReminder: vi.fn().mockResolvedValue(undefined),
    notifyReservationPrompt: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;
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

    expect(
      (notifications as any).notifyReservationReminder,
    ).toHaveBeenCalledTimes(1);
    expect((supabase as any).__updates.length).toBeGreaterThan(0);
    expect((supabase as any).__updates[0].payload).toHaveProperty(
      "reminder_sent_at",
    );
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

    expect(
      (notifications as any).notifyReservationPrompt,
    ).toHaveBeenCalledTimes(1);
    expect((supabase as any).__updates.length).toBeGreaterThan(0);
    expect((supabase as any).__updates.at(-1).payload).toHaveProperty(
      "prompt_sent_at",
    );
  });
});
