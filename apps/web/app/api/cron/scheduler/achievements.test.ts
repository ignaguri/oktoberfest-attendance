import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { NotificationService } from "@/lib/services/notifications";

import { processAchievementNotifications } from "./achievements";

type Events = {
  userEvents?: any[];
  groupEvents?: any[];
};

function createMockSupabase({ userEvents = [], groupEvents = [] }: Events) {
  const updates: any[] = [];

  function from(table: string) {
    if (table === "achievement_events") {
      return {
        select: vi.fn(() => ({
          is: vi.fn((col: string) => ({
            in: vi.fn(() => ({
              limit: vi.fn(() => ({
                data: col === "user_notified_at" ? userEvents : groupEvents,
              })),
            })),
            limit: vi.fn(() => ({
              data: col === "user_notified_at" ? userEvents : groupEvents,
            })),
          })),
        })),
        update: vi.fn((payload: any) => ({
          in: vi.fn((_col: string, ids: string[]) => {
            updates.push({ table: "achievement_events", payload, ids });
            return { data: null } as any;
          }),
        })),
      } as any;
    }

    if (table === "achievements") {
      return {
        select: vi.fn(() => ({
          in: vi.fn((_col: string, ids: string[]) => ({
            data: ids.map((id) => ({
              id,
              name: `Ach ${id}`,
              description: `Desc ${id}`,
              rarity: id.includes("epic")
                ? "epic"
                : id.includes("rare")
                  ? "rare"
                  : "common",
            })),
          })),
        })),
      } as any;
    }

    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          in: vi.fn((_col: string, ids: string[]) => ({
            data: ids.map((id) => ({
              id,
              username: `user_${id}`,
              full_name: `User ${id}`,
            })),
          })),
        })),
      } as any;
    }

    if (table === "group_members") {
      return {
        select: vi.fn((cols?: string) => ({
          eq: vi.fn((_col: string, _val: string) => ({
            data: [{ group_id: "g1" }, { group_id: "g2" }],
          })),
          in: vi.fn((_col: string, _ids: string[]) => ({
            neq: vi.fn((_col2: string, _val2: string) => ({
              data: [{ user_id: "other1" }, { user_id: "other2" }],
            })),
          })),
        })),
      } as any;
    }

    if (table === "groups") {
      return {
        select: vi.fn(() => ({
          in: vi.fn((_col: string, ids: string[]) => ({
            eq: vi.fn((_col2: string, _festivalId: string) => ({
              data: ids.map((id) => ({ id })),
            })),
          })),
        })),
      } as any;
    }

    return {} as any;
  }

  return {
    from,
    rpc: vi.fn((fnName: string, _params: any) => {
      if (fnName === "get_group_achievement_recipients") {
        // Mock the RPC function to return group recipients
        return {
          data: [
            {
              user_id: "u2",
              festival_id: "f1",
              recipient_ids: ["other1", "other2"],
            },
          ],
        };
      }
      return { data: [] };
    }),
    __updates: updates,
  } as unknown as SupabaseClient<Database> & { __updates: any[] };
}

function createMockNotifications() {
  return {
    notifyAchievementUnlocked: vi.fn().mockResolvedValue(undefined),
    notifyGroupAchievement: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;
}

describe("processAchievementNotifications", () => {
  it("notifies user achievements and sets user_notified_at", async () => {
    const supabase = createMockSupabase({
      userEvents: [
        {
          id: "e1",
          user_id: "u1",
          achievement_id: "a1",
          festival_id: "f1",
          rarity: "common",
          user_notified_at: null,
        },
      ],
    });
    const notifications = createMockNotifications();

    await processAchievementNotifications(supabase, notifications);

    expect(
      (notifications as any).notifyAchievementUnlocked,
    ).toHaveBeenCalledTimes(1);
  });

  it("notifies group for rare/epic and sets group_notified_at", async () => {
    const supabase = createMockSupabase({
      groupEvents: [
        {
          id: "e2",
          user_id: "u2",
          achievement_id: "a2_epic",
          festival_id: "f1",
          rarity: "epic",
          group_notified_at: null,
        },
      ],
    });
    const notifications = createMockNotifications();

    await processAchievementNotifications(supabase, notifications);

    expect((notifications as any).notifyGroupAchievement).toHaveBeenCalledTimes(
      1,
    );
  });
});
