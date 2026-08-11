// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test -- --run pending-unlocks.integration
import { randomUUID } from "crypto";
import { afterEach, describe, expect, it } from "vitest";

import { describeUnlock, tierToRarity } from "@prostcounter/shared/achievements";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";
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

  // Regression: every other test here drives the repository with the service-role
  // client, which bypasses RLS, so all of them passed while the route — which uses
  // the request-scoped user client — silently wrote nothing for want of an UPDATE
  // policy. Acking has to be exercised as the user to mean anything.
  it("stamps through a user-scoped client, so RLS actually permits the write", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const anon = createTestSupabaseAnon();

    const { data: auth, error: signInError } = await anon.auth.signInWithPassword({
      email: "user1@example.com",
      password: "password",
    });
    if (signInError || !auth.session) {
      throw new Error(
        `Could not sign in as the seeded user1@example.com: ${signInError?.message}; seed the local database first`,
      );
    }

    const userId = auth.session.user.id;
    const achievementId = await getRealAchievementId(supabaseAdmin, "first_drink");
    const eventId = await insertEvent(supabaseAdmin, userId, achievementId);
    insertedEventIds.push(eventId);

    const repo = new AchievementMetricsRepository(
      createTestSupabaseWithAuth(auth.session.access_token),
    );
    const acknowledged = await repo.markUnlocksSeen(userId, [eventId]);

    expect(acknowledged).toBe(1);

    const { data } = await supabaseAdmin
      .from("achievement_events")
      .select("user_notified_at")
      .eq("id", eventId)
      .single();
    expect(data?.user_notified_at).not.toBeNull();
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

// The outbox trigger (trg_user_achievements_insert_event ->
// insert_achievement_event_from_unlock) is the riskiest thing the rarity
// migration touches: if it throws, the user_achievements INSERT fails, and
// evaluateAfterWrite catches and logs, so unlocking breaks silently. It had no
// coverage at all before this block. The tests above insert achievement_events
// rows directly with a hardcoded rarity and never fire the trigger.
describe("the unlock outbox trigger derives rarity from tier", () => {
  const insertedAchievementIds: string[] = [];

  afterEach(async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    if (insertedAchievementIds.length > 0) {
      // user_achievements and achievement_events both cascade off the
      // achievement FK, so deleting the achievement clears all three rows.
      await supabaseAdmin.from("achievements").delete().in("id", insertedAchievementIds);
      insertedAchievementIds.length = 0;
    }
  });

  // Every real achievement's stored rarity agrees with its tier, so a test
  // built on one could not distinguish a derived value from a stored one.
  // These throwaway rows never set `rarity`, taking the column's 'common'
  // default, so tiers 2 to 4 disagree with it on purpose: the assertion holds
  // only if the trigger reads `tier`. Against the pre-migration trigger the
  // tier-4 case fails with "expected 'common' to be 'legendary'".
  it.each([
    { tier: 1, expected: "common" },
    { tier: 2, expected: "rare" },
    { tier: 3, expected: "epic" },
    { tier: 4, expected: "legendary" },
  ])("stamps $expected on the outbox event for a tier-$tier unlock", async ({ tier, expected }) => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const [userId] = await getTwoUserIds(supabaseAdmin);

    const suffix = randomUUID();
    const { data: achievement, error: achievementError } = await supabaseAdmin
      .from("achievements")
      .insert({
        slug: `test-tier-derivation-${suffix}`,
        name: `Test Tier Derivation ${suffix}`,
        description: "Throwaway achievement for the outbox rarity derivation test",
        category: "drinking",
        icon: "test-icon",
        tier,
      })
      .select("id")
      .single();
    if (achievementError || !achievement) {
      throw new Error(`Failed to create the test achievement: ${achievementError?.message}`);
    }
    insertedAchievementIds.push(achievement.id);

    const { error: unlockError } = await supabaseAdmin
      .from("user_achievements")
      .insert({ user_id: userId, achievement_id: achievement.id });
    if (unlockError) {
      throw new Error(`Failed to insert the unlock row: ${unlockError.message}`);
    }

    const { data: event, error: eventError } = await supabaseAdmin
      .from("achievement_events")
      .select("rarity")
      .eq("user_id", userId)
      .eq("achievement_id", achievement.id)
      .single();
    if (eventError || !event) {
      throw new Error(
        `The trigger wrote no outbox row for the unlock: ${eventError?.message ?? "no row"}`,
      );
    }

    expect(event.rarity).toBe(expected);
    // Pins the SQL helper and the TS helper to the same answer, which is the
    // whole point of deriving rather than storing.
    expect(event.rarity).toBe(tierToRarity(tier));
  });
});
