import type { NotificationService } from "@/lib/services/notifications";
import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function processAchievementNotifications(
  supabase: SupabaseClient<Database>,
  notifications: NotificationService,
) {
  const { data: userEvents } = await supabase
    .from("achievement_events")
    .select(
      "id, user_id, achievement_id, festival_id, rarity, user_notified_at",
    )
    .is("user_notified_at", null)
    .limit(200);

  if (Array.isArray(userEvents) && userEvents.length) {
    const achievementIds = Array.from(
      new Set(userEvents.map((e) => e.achievement_id)),
    );
    const { data: achievements } = await supabase
      .from("achievements")
      .select("id, name, description, rarity")
      .in("id", achievementIds);
    const achIdToMeta = new Map<string, any>(
      (achievements || []).map((a) => [a.id, a]),
    );

    await Promise.allSettled(
      userEvents.map((e) =>
        notifications.notifyAchievementUnlocked(e.user_id, {
          achievementId: e.achievement_id,
          achievementName: achIdToMeta.get(e.achievement_id)?.name || "",
          description:
            achIdToMeta.get(e.achievement_id)?.description || undefined,
          rarity:
            (achIdToMeta.get(e.achievement_id)?.rarity as any) || "common",
        }),
      ),
    );

    await supabase
      .from("achievement_events")
      .update({ user_notified_at: new Date().toISOString() })
      .in(
        "id",
        userEvents.map((e) => e.id),
      );
  }

  const { data: groupEvents } = await supabase
    .from("achievement_events")
    .select(
      "id, user_id, achievement_id, festival_id, rarity, group_notified_at",
    )
    .is("group_notified_at", null)
    .in("rarity", ["rare", "epic"])
    .limit(200);

  if (Array.isArray(groupEvents) && groupEvents.length) {
    const userIds = Array.from(new Set(groupEvents.map((e) => e.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .in("id", userIds);
    const userIdToName = new Map<string, string>(
      (profiles || []).map((p) => [
        p.id,
        p.username || p.full_name || "Someone",
      ]),
    );

    const achievementIds = Array.from(
      new Set(groupEvents.map((e) => e.achievement_id)),
    );
    const { data: achievements } = await supabase
      .from("achievements")
      .select("id, name, rarity")
      .in("id", achievementIds);
    const achIdToMeta = new Map<string, any>(
      (achievements || []).map((a) => [a.id, a]),
    );

    // Use RPC function to get all group achievement recipients in a single query
    // This eliminates the N+1 query pattern
    const { data: groupRecipients } = await supabase.rpc(
      "get_group_achievement_recipients",
      {
        p_user_ids: userIds,
        p_festival_ids: Array.from(
          new Set(groupEvents.map((e) => e.festival_id)),
        ),
      },
    );

    // Create a map for quick lookup of recipients by user_id and festival_id
    const recipientMap = new Map<string, string[]>();
    (groupRecipients || []).forEach((recipient) => {
      const key = `${recipient.user_id}:${recipient.festival_id}`;
      recipientMap.set(key, recipient.recipient_ids);
    });

    // Process each group event and send notifications
    const notificationPromises = groupEvents.map((e) => {
      const key = `${e.user_id}:${e.festival_id}`;
      const recipientIds = recipientMap.get(key);

      if (!recipientIds || recipientIds.length === 0) return Promise.resolve();

      return notifications.notifyGroupAchievement(recipientIds, {
        achieverName: userIdToName.get(e.user_id) || "Someone",
        achievementName: achIdToMeta.get(e.achievement_id)?.name || "",
        rarity: (achIdToMeta.get(e.achievement_id)?.rarity as any) || "rare",
      });
    });
    await Promise.allSettled(notificationPromises);

    await supabase
      .from("achievement_events")
      .update({ group_notified_at: new Date().toISOString() })
      .in(
        "id",
        groupEvents.map((e) => e.id),
      );
  }
}
