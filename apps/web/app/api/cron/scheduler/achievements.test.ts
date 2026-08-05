import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { NotificationService } from "@/lib/services/notifications";

import { processAchievementNotifications } from "./achievements";

type GroupRecipient = {
  user_id: string;
  festival_id: string | null;
  recipient_ids: string[];
};

type Events = {
  userEvents?: any[];
  groupEvents?: any[];
  groupRecipients?: GroupRecipient[];
};

const DEFAULT_GROUP_RECIPIENTS: GroupRecipient[] = [
  {
    user_id: "u2",
    festival_id: "f1",
    recipient_ids: ["other1", "other2"],
  },
];

function createMockSupabase({
  userEvents = [],
  groupEvents = [],
  groupRecipients = DEFAULT_GROUP_RECIPIENTS,
}: Events) {
  const updates: any[] = [];

  function from(table: string) {
    if (table === "achievement_events") {
      return {
        select: vi.fn(() => ({
          is: vi.fn((col: string) => {
            const rows = col === "user_notified_at" ? userEvents : groupEvents;
            return {
              // Faithfully filters the fixture rather than ignoring its
              // arguments, so tests asserting on the result are actually
              // pinned to this call happening with these exact args.
              in: vi.fn((inCol: string, allowed: unknown) => {
                const scoped =
                  inCol === "rarity" && Array.isArray(allowed)
                    ? rows.filter((row: any) => (allowed as string[]).includes(row.rarity))
                    : rows;

                return {
                  not: vi.fn((filterCol: string, operator: string, value: unknown) => ({
                    limit: vi.fn(() => ({
                      data:
                        filterCol === "festival_id" && operator === "is" && value === null
                          ? scoped.filter((row: any) => row.festival_id !== null)
                          : scoped,
                    })),
                  })),
                  limit: vi.fn(() => ({
                    data: scoped,
                  })),
                };
              }),
              limit: vi.fn(() => ({
                data: rows,
              })),
            };
          }),
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
              rarity: id.includes("legendary")
                ? "legendary"
                : id.includes("epic")
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
        select: vi.fn((_cols?: string) => ({
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
          data: groupRecipients,
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

    expect((notifications as any).notifyAchievementUnlocked).toHaveBeenCalledTimes(1);
  });

  it("still notifies the user for a lifetime unlock with a null festival_id", async () => {
    const supabase = createMockSupabase({
      userEvents: [
        {
          id: "e3",
          user_id: "u4",
          achievement_id: "a4_lifetime",
          festival_id: null,
          rarity: "common",
          user_notified_at: null,
        },
      ],
    });
    const notifications = createMockNotifications();

    await processAchievementNotifications(supabase, notifications);

    expect((notifications as any).notifyAchievementUnlocked).toHaveBeenCalledTimes(1);
    expect((notifications as any).notifyAchievementUnlocked).toHaveBeenCalledWith(
      "u4",
      expect.objectContaining({ achievementId: "a4_lifetime" }),
    );
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

    expect((notifications as any).notifyGroupAchievement).toHaveBeenCalledTimes(1);
  });

  it("notifies group for legendary unlocks, the rarest tier", async () => {
    const supabase = createMockSupabase({
      groupEvents: [
        {
          id: "e4",
          user_id: "u2",
          achievement_id: "a4_legendary",
          festival_id: "f1",
          rarity: "legendary",
          group_notified_at: null,
        },
      ],
    });
    const notifications = createMockNotifications();

    await processAchievementNotifications(supabase, notifications);

    expect((notifications as any).notifyGroupAchievement).toHaveBeenCalledTimes(1);
    expect((notifications as any).notifyGroupAchievement).toHaveBeenCalledWith(
      ["other1", "other2"],
      expect.objectContaining({ rarity: "legendary" }),
    );
  });

  it("does not notify group for common unlocks", async () => {
    const supabase = createMockSupabase({
      groupEvents: [
        {
          id: "e5",
          user_id: "u2",
          achievement_id: "a5_plain",
          festival_id: "f1",
          rarity: "common",
          group_notified_at: null,
        },
      ],
    });
    const notifications = createMockNotifications();

    await processAchievementNotifications(supabase, notifications);

    expect((notifications as any).notifyGroupAchievement).not.toHaveBeenCalled();
  });

  it("excludes lifetime (null festival_id) events from the group notification path", async () => {
    const supabase = createMockSupabase({
      groupEvents: [
        {
          id: "eA",
          user_id: "u2",
          achievement_id: "a2_epic",
          festival_id: "f1",
          rarity: "epic",
          group_notified_at: null,
        },
        {
          id: "eB",
          user_id: "u3",
          achievement_id: "a3_epic",
          festival_id: null,
          rarity: "epic",
          group_notified_at: null,
        },
      ],
      // A recipient IS registered for the null-festival row (u3). If the
      // .not("festival_id", "is", null) filter were ever removed, this event
      // would find a recipient and notifyGroupAchievement would fire twice,
      // failing the toHaveBeenCalledTimes(1) assertion below.
      groupRecipients: [
        { user_id: "u2", festival_id: "f1", recipient_ids: ["other1", "other2"] },
        { user_id: "u3", festival_id: null, recipient_ids: ["other3"] },
      ],
    });
    const notifications = createMockNotifications();

    await processAchievementNotifications(supabase, notifications);

    expect((notifications as any).notifyGroupAchievement).toHaveBeenCalledTimes(1);
    expect((notifications as any).notifyGroupAchievement).toHaveBeenCalledWith(
      ["other1", "other2"],
      expect.objectContaining({ achievementName: "Ach a2_epic" }),
    );
  });
});
