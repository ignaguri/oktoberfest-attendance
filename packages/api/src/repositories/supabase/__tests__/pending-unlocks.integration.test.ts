// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test -- --run pending-unlocks.integration
import { afterEach, describe, expect, it } from "vitest";

import { describeUnlock } from "@prostcounter/shared/achievements";

import { createTestSupabaseAdmin } from "../../../__tests__/helpers/test-supabase";
import { AchievementMetricsRepository } from "../achievement-metrics.repository";

async function getTwoUserIds(
  supabaseAdmin: ReturnType<typeof createTestSupabaseAdmin>,
): Promise<[string, string]> {
  const { data: rows, error } = await supabaseAdmin.from("profiles").select("id").limit(2);
  if (error || !rows || rows.length < 2) {
    throw new Error("Need at least 2 seeded profiles in the local database; seed it first");
  }
  return [rows[0].id, rows[1].id];
}

async function getRealAchievementId(
  supabaseAdmin: ReturnType<typeof createTestSupabaseAdmin>,
  slug: string,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("achievements")
    .select("id")
    .eq("slug", slug)
    .single();
  if (error || !data) {
    throw new Error(
      `Achievement registry is missing slug "${slug}"; run pnpm --filter=@prostcounter/api sync:achievements`,
    );
  }
  return data.id;
}

async function insertEvent(
  supabaseAdmin: ReturnType<typeof createTestSupabaseAdmin>,
  userId: string,
  achievementId: string,
  userNotifiedAt: string | null = null,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("achievement_events")
    .insert({
      user_id: userId,
      achievement_id: achievementId,
      rarity: "common",
      user_notified_at: userNotifiedAt,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed to insert test achievement_events row: ${error?.message}`);
  }
  return data.id;
}

describe("pending unlocks outbox against a real database", () => {
  const insertedEventIds: string[] = [];
  const insertedAchievementIds: string[] = [];

  afterEach(async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    if (insertedEventIds.length > 0) {
      await supabaseAdmin.from("achievement_events").delete().in("id", insertedEventIds);
      insertedEventIds.length = 0;
    }
    if (insertedAchievementIds.length > 0) {
      await supabaseAdmin.from("achievements").delete().in("id", insertedAchievementIds);
      insertedAchievementIds.length = 0;
    }
  });

  it("returns an inserted-but-unacked unlock populated from the definitions", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const [userId] = await getTwoUserIds(supabaseAdmin);
    const achievementId = await getRealAchievementId(supabaseAdmin, "first_drink");
    const eventId = await insertEvent(supabaseAdmin, userId, achievementId);
    insertedEventIds.push(eventId);

    const descriptor = describeUnlock("first_drink");
    expect(descriptor).not.toBeNull();

    const repo = new AchievementMetricsRepository(supabaseAdmin);
    // Cap at 1: our freshly-inserted row is the newest for this user, so it is
    // guaranteed to be the sole result regardless of what else is pending.
    const [pending] = await repo.listPendingUnlocks(userId, 1);

    expect(pending).toEqual(
      expect.objectContaining({
        eventId,
        slug: "first_drink",
        tier: descriptor?.tier,
        glyph: descriptor?.glyph,
        points: descriptor?.points,
        category: descriptor?.category,
        scope: descriptor?.scope,
      }),
    );
    expect(typeof pending.unlockedAt).toBe("string");
  });

  it("excludes an event whose user_notified_at is set", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const [userId] = await getTwoUserIds(supabaseAdmin);
    const achievementId = await getRealAchievementId(supabaseAdmin, "first_drink");
    const eventId = await insertEvent(supabaseAdmin, userId, achievementId, new Date().toISOString());
    insertedEventIds.push(eventId);

    const repo = new AchievementMetricsRepository(supabaseAdmin);
    const pending = await repo.listPendingUnlocks(userId, 50);

    expect(pending.find((unlock) => unlock.eventId === eventId)).toBeUndefined();
  });

  it("stamps the given events and returns the count", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const [userId] = await getTwoUserIds(supabaseAdmin);
    const achievementId = await getRealAchievementId(supabaseAdmin, "first_drink");
    const eventId = await insertEvent(supabaseAdmin, userId, achievementId);
    insertedEventIds.push(eventId);

    const repo = new AchievementMetricsRepository(supabaseAdmin);
    const acknowledged = await repo.markUnlocksSeen(userId, [eventId]);

    expect(acknowledged).toBe(1);

    const { data } = await supabaseAdmin
      .from("achievement_events")
      .select("user_notified_at")
      .eq("id", eventId)
      .single();
    expect(data?.user_notified_at).not.toBeNull();
  });

  it("returns 0 the second time the same ids are acked", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const [userId] = await getTwoUserIds(supabaseAdmin);
    const achievementId = await getRealAchievementId(supabaseAdmin, "first_drink");
    const eventId = await insertEvent(supabaseAdmin, userId, achievementId);
    insertedEventIds.push(eventId);

    const repo = new AchievementMetricsRepository(supabaseAdmin);
    const first = await repo.markUnlocksSeen(userId, [eventId]);
    const second = await repo.markUnlocksSeen(userId, [eventId]);

    expect(first).toBe(1);
    expect(second).toBe(0);
  });

  it("does not stamp another user's events", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const [userId, otherUserId] = await getTwoUserIds(supabaseAdmin);
    const achievementId = await getRealAchievementId(supabaseAdmin, "first_drink");
    const eventId = await insertEvent(supabaseAdmin, userId, achievementId);
    insertedEventIds.push(eventId);

    const repo = new AchievementMetricsRepository(supabaseAdmin);
    const acknowledged = await repo.markUnlocksSeen(otherUserId, [eventId]);

    expect(acknowledged).toBe(0);

    const { data } = await supabaseAdmin
      .from("achievement_events")
      .select("user_notified_at")
      .eq("id", eventId)
      .single();
    expect(data?.user_notified_at).toBeNull();
  });

  it("omits an event whose slug matches no definition rather than crashing", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const [userId] = await getTwoUserIds(supabaseAdmin);

    const { data: fakeAchievement, error: fakeAchievementError } = await supabaseAdmin
      .from("achievements")
      .insert({
        slug: `test-unknown-slug-${Date.now()}`,
        category: "drinking",
        description: "Test achievement with a slug no definition owns",
        icon: "test-icon",
        name: "Test Unknown Achievement",
      })
      .select("id")
      .single();
    if (fakeAchievementError || !fakeAchievement) {
      throw new Error(`Failed to create test achievement: ${fakeAchievementError?.message}`);
    }
    insertedAchievementIds.push(fakeAchievement.id);

    const eventId = await insertEvent(supabaseAdmin, userId, fakeAchievement.id);
    insertedEventIds.push(eventId);

    const repo = new AchievementMetricsRepository(supabaseAdmin);
    // Cap at 1 so the unresolvable row (the newest for this user) would be the
    // sole candidate if it weren't dropped — an empty array proves it was
    // filtered out rather than merely outranked by something else pending.
    const pending = await repo.listPendingUnlocks(userId, 1);

    expect(pending).toEqual([]);
  });
});
