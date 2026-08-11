import type { Database } from "@prostcounter/db";
import { tierToRarity } from "@prostcounter/shared/achievements";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotificationService } from "@/lib/services/notifications";

export async function processAchievementNotifications(
  supabase: SupabaseClient<Database>,
  notifications: NotificationService,
) {
  const { data: userEvents } = await supabase
    .from("achievement_events")
    .select("id, user_id, achievement_id, festival_id, rarity, user_notified_at")
    .is("user_notified_at", null)
    .limit(200);

  if (Array.isArray(userEvents) && userEvents.length) {
    const achievementIds = Array.from(new Set(userEvents.map((e) => e.achievement_id)));
    const { data: achievements } = await supabase
      .from("achievements")
      .select("id, name, description, tier, slug")
      .in("id", achievementIds);
    const achIdToMeta = new Map<string, any>((achievements || []).map((a) => [a.id, a]));

    // New-engine achievements (achievements.slug is set) still carry the raw
    // i18n key as their name (e.g. "achievements.drinks_total.t2.name") until
    // Plan 3 ships real copy. Sending that as notification text would be
    // garbage, so those events are muted: marked notified without a push,
    // and never retried. Legacy achievements (slug is null) already have
    // real names and notify as before.
    const legacyUserEvents = userEvents.filter((e) => !achIdToMeta.get(e.achievement_id)?.slug);

    await Promise.allSettled(
      legacyUserEvents.map((e) =>
        notifications.notifyAchievementUnlocked(e.user_id, {
          achievementId: e.achievement_id,
          achievementName: achIdToMeta.get(e.achievement_id)?.name || "",
          description: achIdToMeta.get(e.achievement_id)?.description || undefined,
          rarity: tierToRarity(achIdToMeta.get(e.achievement_id)?.tier),
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
    .select("id, user_id, achievement_id, festival_id, rarity, group_notified_at")
    .is("group_notified_at", null)
    .in("rarity", ["rare", "epic", "legendary"])
    // Lifetime unlocks carry a NULL festival_id and have no festival group
    // audience to notify, so exclude them from the group notification path.
    .not("festival_id", "is", null)
    .limit(200);

  if (Array.isArray(groupEvents) && groupEvents.length) {
    const userIds = Array.from(new Set(groupEvents.map((e) => e.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .in("id", userIds);
    const userIdToName = new Map<string, string>(
      (profiles || []).map((p) => [p.id, p.username || p.full_name || "Someone"]),
    );

    const achievementIds = Array.from(new Set(groupEvents.map((e) => e.achievement_id)));
    const { data: achievements } = await supabase
      .from("achievements")
      .select("id, name, tier, slug")
      .in("id", achievementIds);
    const achIdToMeta = new Map<string, any>((achievements || []).map((a) => [a.id, a]));

    // Same mute as the user-notification path above: new-engine achievements
    // (slug set) still have a raw i18n key for a name until Plan 3 ships
    // real copy, so they're muted rather than announced to a whole group.
    const legacyGroupEvents = groupEvents.filter((e) => !achIdToMeta.get(e.achievement_id)?.slug);

    // Use RPC function to get all group achievement recipients in a single query
    // This eliminates the N+1 query pattern
    const { data: groupRecipients } = await supabase.rpc("get_group_achievement_recipients", {
      p_user_ids: userIds,
      p_festival_ids: Array.from(new Set(groupEvents.map((e) => e.festival_id))),
    });

    // Create a map for quick lookup of recipients by user_id and festival_id
    const recipientMap = new Map<string, string[]>();
    (groupRecipients || []).forEach((recipient) => {
      const key = `${recipient.user_id}:${recipient.festival_id}`;
      recipientMap.set(key, recipient.recipient_ids);
    });

    // Process each group event and send notifications
    const notificationPromises = legacyGroupEvents.map((e) => {
      const key = `${e.user_id}:${e.festival_id}`;
      const recipientIds = recipientMap.get(key);

      if (!recipientIds || recipientIds.length === 0) return Promise.resolve();

      return notifications.notifyGroupAchievement(recipientIds, {
        achieverName: userIdToName.get(e.user_id) || "Someone",
        achievementName: achIdToMeta.get(e.achievement_id)?.name || "",
        rarity: tierToRarity(achIdToMeta.get(e.achievement_id)?.tier),
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
