// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test -- --run achievement-unlock.integration
import type { OpenAPIHono } from "@hono/zod-openapi";
import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";

import { ACHIEVEMENT_METRIC_KEYS } from "@prostcounter/shared/achievements";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
} from "../../__tests__/helpers/test-supabase";
import { createTestApp } from "../../__tests__/helpers/test-server";
import type { AuthContext } from "../../middleware/auth";
import { authMiddleware } from "../../middleware/auth";
import { AchievementMetricsRepository } from "../../repositories/supabase/achievement-metrics.repository";
import { AchievementService } from "../../services/achievement.service";
import attendanceRoutes from "../attendance.route";
import crowdReportRoutes from "../crowd-report.route";
import friendRoutes from "../friend.route";
import groupRoutes from "../group.route";
import photoRoutes from "../photo.route";
import photoSocialRoutes from "../photo-social.route";
import profileRoutes from "../profile.route";
import wrappedRoutes from "../wrapped.route";

async function getTarget(supabaseAdmin: ReturnType<typeof createTestSupabaseAdmin>) {
  const { data: rows } = await supabaseAdmin
    .from("attendances")
    .select("user_id, festival_id")
    .limit(1);

  const target = rows?.[0];
  if (!target) {
    throw new Error("No attendance rows in local database; seed it first");
  }
  return target as { user_id: string; festival_id: string };
}

/**
 * Signs up a throwaway user and returns their id + access token, for hitting
 * routes through the real authMiddleware.
 */
async function createTestUser() {
  const supabaseAnon = createTestSupabaseAnon();
  const email = `unlock-route-${randomUUID()}@integration-test.com`;
  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password: "test-password-123!",
  });
  if (error || !data.user || !data.session) {
    throw new Error(`Failed to create test user: ${error?.message ?? "unknown error"}`);
  }
  return { id: data.user.id, token: data.session.access_token };
}

/** Creates a throwaway festival, isolating held-slug state from other tests. */
async function createTestFestival(supabaseAdmin: ReturnType<typeof createTestSupabaseAdmin>) {
  const suffix = randomUUID();
  const { data: festival, error } = await supabaseAdmin
    .from("festivals")
    .insert({
      name: `Unlock Route Test Festival ${suffix}`,
      short_name: `unlock-route-${suffix}`.slice(0, 40),
      festival_type: "oktoberfest",
      start_date: "2024-09-21",
      end_date: "2024-10-06",
      beer_cost: 16.2,
      location: "Test Location",
      timezone: "Europe/Berlin",
      is_active: false,
      status: "ended",
    })
    .select()
    .single();
  if (error || !festival) {
    throw new Error(`Failed to create test festival: ${error?.message}`);
  }
  return festival;
}

/** Mounts a route module behind the real auth middleware, like the production app does. */
function mountRoute(routes: OpenAPIHono<AuthContext>) {
  const app = createTestApp();
  app.use("*", authMiddleware);
  app.route("/", routes);
  return app;
}

/** Narrows a route response body to just the field these tests assert on. */
async function unlockedFrom(response: Response): Promise<{ unlocked: unknown }> {
  return (await response.json()) as { unlocked: unknown };
}

/** Resolves an achievement's registry row id from its slug. */
async function achievementIdForSlug(
  supabaseAdmin: ReturnType<typeof createTestSupabaseAdmin>,
  slug: string,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("achievements")
    .select("id")
    .eq("slug", slug)
    .single();
  if (error || !data) {
    throw new Error(`Achievement registry has no row for slug "${slug}": ${error?.message}`);
  }
  return data.id;
}

/**
 * Asserts the evaluate-only wiring persisted the unlock: a user_achievements
 * row exists for the slug, and its outbox counterpart in achievement_events
 * is unacked (user_notified_at is null) - the same row GET /achievements/pending
 * would surface to the client.
 */
async function expectUnlockPersisted(
  supabaseAdmin: ReturnType<typeof createTestSupabaseAdmin>,
  userId: string,
  slug: string,
): Promise<void> {
  const achievementId = await achievementIdForSlug(supabaseAdmin, slug);

  const { data: unlockRow } = await supabaseAdmin
    .from("user_achievements")
    .select("id")
    .eq("user_id", userId)
    .eq("achievement_id", achievementId)
    .maybeSingle();
  expect(unlockRow).not.toBeNull();

  const { data: eventRow } = await supabaseAdmin
    .from("achievement_events")
    .select("id, user_notified_at")
    .eq("user_id", userId)
    .eq("achievement_id", achievementId)
    .maybeSingle();
  expect(eventRow).not.toBeNull();
  expect(eventRow?.user_notified_at).toBeNull();
}

describe("achievement unlocking against a real database", () => {
  it("unlocks the first-drink achievement for a user with consumptions", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const target = await getTarget(supabaseAdmin);

    const repo = new AchievementMetricsRepository(supabaseAdmin);
    const service = new AchievementService(repo);

    // Compares the real SQL function's key set against AchievementMetrics,
    // not just a count: a renamed or dropped SQL key would pass a bare
    // toHaveLength(30) (still 30 keys, just the wrong ones) but fails this.
    const metrics = await repo.getMetrics(target.user_id, target.festival_id);
    expect(Object.keys(metrics).sort()).toEqual([...ACHIEVEMENT_METRIC_KEYS].sort());

    const unlocked = await service.evaluateAndUnlock(target.user_id, target.festival_id);

    // Second call must be a no-op: everything is already held.
    const second = await service.evaluateAndUnlock(target.user_id, target.festival_id);
    expect(second).toEqual([]);
    expect(Array.isArray(unlocked)).toBe(true);
    for (const unlock of unlocked) {
      expect(unlock).toEqual(expect.objectContaining({ eventId: expect.any(String) }));
    }
  });

  it("returns unlocks the first time and an empty array the second time", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    // Reuse an existing seeded user, but evaluate against a brand-new festival
    // this user has never attended. Held slugs are scoped per (user, festival),
    // so this guarantees a clean slate regardless of what earlier test runs
    // (in this file or previous suite runs against this persistent local DB)
    // already unlocked for that user elsewhere — unlike getTarget()'s arbitrary
    // pre-seeded row, which may already hold everything by the time this runs.
    const existing = await getTarget(supabaseAdmin);

    const { data: festival, error: festivalError } = await supabaseAdmin
      .from("festivals")
      .insert({
        name: `Unlock Test Festival ${Date.now()}`,
        short_name: `unlock-test-${Date.now()}`,
        festival_type: "oktoberfest",
        start_date: "2024-09-21",
        end_date: "2024-10-06",
        beer_cost: 16.2,
        location: "Test Location",
        timezone: "Europe/Berlin",
        is_active: false,
        status: "ended",
      })
      .select()
      .single();
    if (festivalError || !festival) {
      throw new Error(`Failed to create test festival: ${festivalError?.message}`);
    }

    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from("attendances")
      .insert({ user_id: existing.user_id, festival_id: festival.id, date: "2024-09-21" })
      .select()
      .single();
    if (attendanceError || !attendance) {
      throw new Error(`Failed to create test attendance: ${attendanceError?.message}`);
    }

    // drinks_total tier 1 unlocks at 3 drinks (see SERIES in
    // packages/shared/src/achievements/definitions.ts).
    const { error: consumptionsError } = await supabaseAdmin.from("consumptions").insert([
      { attendance_id: attendance.id, drink_type: "beer", base_price_cents: 1620, price_paid_cents: 1620, volume_ml: 1000 },
      { attendance_id: attendance.id, drink_type: "beer", base_price_cents: 1620, price_paid_cents: 1620, volume_ml: 1000 },
      { attendance_id: attendance.id, drink_type: "beer", base_price_cents: 1620, price_paid_cents: 1620, volume_ml: 1000 },
    ]);
    if (consumptionsError) {
      throw new Error(`Failed to create test consumptions: ${consumptionsError.message}`);
    }

    const repo = new AchievementMetricsRepository(supabaseAdmin);
    const service = new AchievementService(repo);

    const first = await service.evaluateAndUnlock(existing.user_id, festival.id);
    const second = await service.evaluateAndUnlock(existing.user_id, festival.id);

    expect(first.length).toBeGreaterThan(0);
    expect(first.map((u) => u.slug)).toContain("drinks_total.t1");
    for (const unlock of first) {
      expect(unlock.eventId).toEqual(expect.any(String));
    }
    expect(second).toEqual([]);

    // Cleanup: consumptions, user_achievements and achievement_events all
    // cascade off their FKs, but attendances -> festivals does not (plain
    // FK, no ON DELETE), so the attendance must go before the festival or
    // the festival delete fails.
    await supabaseAdmin.from("attendances").delete().eq("id", attendance.id);
    await supabaseAdmin.from("festivals").delete().eq("id", festival.id);
  });
});

describe("inline unlock wiring on the write-path routes", () => {
  it("POST /attendance returns the unlock inline, and is a no-op the second time", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const user = await createTestUser();
    const festival = await createTestFestival(supabaseAdmin);
    const app = mountRoute(attendanceRoutes);

    const body = JSON.stringify({ festivalId: festival.id, date: "2024-09-21", tents: [], amount: 0 });
    const headers = { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" };

    const first = await app.request("/attendance", { method: "POST", headers, body });
    expect(first.status).toBe(200);
    const firstJson = await unlockedFrom(first);
    // days_attended tier 1 unlocks at 1 day (see SERIES in
    // packages/shared/src/achievements/definitions.ts) - a single attendance crosses it.
    expect(firstJson.unlocked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "days_attended.t1", eventId: expect.any(String) }),
      ]),
    );

    const second = await app.request("/attendance", { method: "POST", headers, body });
    expect(second.status).toBe(200);
    const secondJson = await unlockedFrom(second);
    expect(secondJson.unlocked).toEqual([]);

    await supabaseAdmin.from("attendances").delete().eq("user_id", user.id).eq("festival_id", festival.id);
    await supabaseAdmin.from("festivals").delete().eq("id", festival.id);
    await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => undefined);
  });

  it("POST /attendance/personal returns the unlock inline, and is a no-op the second time", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const user = await createTestUser();
    const festival = await createTestFestival(supabaseAdmin);
    const app = mountRoute(attendanceRoutes);

    const body = JSON.stringify({ festivalId: festival.id, date: "2024-09-21", tents: [], amount: 0 });
    const headers = { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" };

    const first = await app.request("/attendance/personal", { method: "POST", headers, body });
    expect(first.status).toBe(200);
    const firstJson = await unlockedFrom(first);
    expect(firstJson.unlocked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "days_attended.t1", eventId: expect.any(String) }),
      ]),
    );

    const second = await app.request("/attendance/personal", { method: "POST", headers, body });
    expect(second.status).toBe(200);
    const secondJson = await unlockedFrom(second);
    expect(secondJson.unlocked).toEqual([]);

    await supabaseAdmin.from("attendances").delete().eq("user_id", user.id).eq("festival_id", festival.id);
    await supabaseAdmin.from("festivals").delete().eq("id", festival.id);
    await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => undefined);
  });

  it("POST /attendance/check-in/{reservationId} returns the unlock inline, and is a no-op once already held", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const user = await createTestUser();
    const festival = await createTestFestival(supabaseAdmin);
    const app = mountRoute(attendanceRoutes);
    const headers = { Authorization: `Bearer ${user.token}` };

    const { data: tent1, error: tent1Error } = await supabaseAdmin
      .from("tents")
      .insert({ id: randomUUID(), name: "Unlock Test Tent 1", category: "large" })
      .select()
      .single();
    if (tent1Error || !tent1) {
      throw new Error(`Failed to create test tent: ${tent1Error?.message}`);
    }
    const { data: tent2, error: tent2Error } = await supabaseAdmin
      .from("tents")
      .insert({ id: randomUUID(), name: "Unlock Test Tent 2", category: "large" })
      .select()
      .single();
    if (tent2Error || !tent2) {
      throw new Error(`Failed to create test tent: ${tent2Error?.message}`);
    }

    const { data: reservation1, error: reservation1Error } = await supabaseAdmin
      .from("reservations")
      .insert({
        user_id: user.id,
        festival_id: festival.id,
        tent_id: tent1.id,
        start_at: "2024-09-21T14:00:00Z",
        status: "pending",
      })
      .select()
      .single();
    if (reservation1Error || !reservation1) {
      throw new Error(`Failed to create test reservation: ${reservation1Error?.message}`);
    }

    // Days_attended tier 1 (target 1 day) is crossed by the first check-in, which
    // creates the attendance record for that date.
    const first = await app.request(`/attendance/check-in/${reservation1.id}`, {
      method: "POST",
      headers,
    });
    expect(first.status).toBe(200);
    const firstJson = await unlockedFrom(first);
    expect(firstJson.unlocked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "days_attended.t1", eventId: expect.any(String) }),
      ]),
    );

    // A second reservation, same user/day, different tent: hits the
    // existing-attendance branch of the handler rather than reusing the same
    // (now-completed) reservation, but exercises the same evaluate-after-write
    // call. days_attended.t1 is already held, so this must be a no-op.
    const { data: reservation2, error: reservation2Error } = await supabaseAdmin
      .from("reservations")
      .insert({
        user_id: user.id,
        festival_id: festival.id,
        tent_id: tent2.id,
        start_at: "2024-09-21T18:00:00Z",
        status: "pending",
      })
      .select()
      .single();
    if (reservation2Error || !reservation2) {
      throw new Error(`Failed to create second test reservation: ${reservation2Error?.message}`);
    }

    const second = await app.request(`/attendance/check-in/${reservation2.id}`, {
      method: "POST",
      headers,
    });
    expect(second.status).toBe(200);
    const secondJson = await unlockedFrom(second);
    expect(secondJson.unlocked).toEqual([]);

    await supabaseAdmin.from("tent_visits").delete().eq("user_id", user.id).eq("festival_id", festival.id);
    await supabaseAdmin.from("reservations").delete().in("id", [reservation1.id, reservation2.id]);
    await supabaseAdmin.from("attendances").delete().eq("user_id", user.id).eq("festival_id", festival.id);
    await supabaseAdmin.from("tents").delete().in("id", [tent1.id, tent2.id]);
    await supabaseAdmin.from("festivals").delete().eq("id", festival.id);
    await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => undefined);
  });

  it("POST /photos/{id}/confirm returns the unlock inline, and is a no-op the second time", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const user = await createTestUser();
    const festival = await createTestFestival(supabaseAdmin);
    const app = mountRoute(photoRoutes);
    const headers = { Authorization: `Bearer ${user.token}` };

    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from("attendances")
      .insert({ user_id: user.id, festival_id: festival.id, date: "2024-09-21" })
      .select()
      .single();
    if (attendanceError || !attendance) {
      throw new Error(`Failed to create test attendance: ${attendanceError?.message}`);
    }

    const { data: picture, error: pictureError } = await supabaseAdmin
      .from("beer_pictures")
      .insert({
        user_id: user.id,
        attendance_id: attendance.id,
        picture_url: `${user.id}/${festival.id}/unlock-test.jpg`,
        visibility: "public",
      })
      .select()
      .single();
    if (pictureError || !picture) {
      throw new Error(`Failed to create test picture: ${pictureError?.message}`);
    }

    // photos_uploaded tier 1 unlocks at 1 photo (see SERIES in
    // packages/shared/src/achievements/definitions.ts).
    const first = await app.request(`/photos/${picture.id}/confirm`, {
      method: "POST",
      headers,
    });
    expect(first.status).toBe(200);
    const firstJson = await unlockedFrom(first);
    expect(firstJson.unlocked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "photos_uploaded.t1", eventId: expect.any(String) }),
      ]),
    );

    const second = await app.request(`/photos/${picture.id}/confirm`, {
      method: "POST",
      headers,
    });
    expect(second.status).toBe(200);
    const secondJson = await unlockedFrom(second);
    expect(secondJson.unlocked).toEqual([]);

    await supabaseAdmin.from("beer_pictures").delete().eq("id", picture.id);
    await supabaseAdmin.from("attendances").delete().eq("id", attendance.id);
    await supabaseAdmin.from("festivals").delete().eq("id", festival.id);
    await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => undefined);
  });
});

describe("evaluate-only unlock wiring on nine more write paths", () => {
  it("POST /photos/{photoId}/reactions persists the unlock without changing the response", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const user = await createTestUser();
    const festival = await createTestFestival(supabaseAdmin);
    const app = mountRoute(photoSocialRoutes);
    const headers = { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" };

    const { data: groupRows, error: groupError } = await supabaseAdmin.rpc(
      "create_group_with_member",
      {
        p_group_name: `Reaction Unlock Group ${randomUUID()}`,
        p_user_id: user.id,
        p_festival_id: festival.id,
        p_winning_criteria_id: 2,
      },
    );
    if (groupError || !groupRows?.[0]) {
      throw new Error(`Failed to create test group: ${groupError?.message}`);
    }
    const groupId = groupRows[0].group_id;

    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from("attendances")
      .insert({ user_id: user.id, festival_id: festival.id, date: "2024-09-21" })
      .select()
      .single();
    if (attendanceError || !attendance) {
      throw new Error(`Failed to create test attendance: ${attendanceError?.message}`);
    }

    const { data: picture, error: pictureError } = await supabaseAdmin
      .from("beer_pictures")
      .insert({
        user_id: user.id,
        attendance_id: attendance.id,
        picture_url: `${user.id}/${festival.id}/reaction-unlock-test.jpg`,
        visibility: "public",
      })
      .select()
      .single();
    if (pictureError || !picture) {
      throw new Error(`Failed to create test picture: ${pictureError?.message}`);
    }

    // reactions_given tier 1 unlocks at 5 (see SERIES in
    // packages/shared/src/achievements/definitions.ts). ALLOWED_EMOJIS has 6
    // entries, so 5 distinct emoji from the same user avoid the unique
    // constraint on (photo_id, group_id, user_id, emoji).
    const emojis = ["\u{1F37A}", "❤️", "\u{1F602}", "\u{1F525}", "\u{1F44F}"];
    let lastResponse: Response | undefined;
    for (const emoji of emojis) {
      lastResponse = await app.request(`/photos/${picture.id}/reactions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ groupId, emoji }),
      });
      expect(lastResponse.status).toBe(200);
    }
    const lastJson = await lastResponse!.json();
    expect(lastJson).toEqual({ success: true });

    await expectUnlockPersisted(supabaseAdmin, user.id, "reactions_given.t1");

    await supabaseAdmin.from("photo_reactions").delete().eq("photo_id", picture.id);
    await supabaseAdmin.from("beer_pictures").delete().eq("id", picture.id);
    await supabaseAdmin.from("attendances").delete().eq("id", attendance.id);
    await supabaseAdmin.from("groups").delete().eq("id", groupId);
    await supabaseAdmin.from("festivals").delete().eq("id", festival.id);
    await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => undefined);
  });

  it("POST /friends/request/{id}/accept persists the unlock without changing the response", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const requester = await createTestUser();
    const addressee = await createTestUser();
    const app = mountRoute(friendRoutes);

    const sendResponse = await app.request("/friends/request", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requester.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ addresseeId: addressee.id }),
    });
    expect(sendResponse.status).toBe(200);
    const sendJson = (await sendResponse.json()) as { friendshipId?: string };
    if (!sendJson.friendshipId) {
      throw new Error("POST /friends/request did not return a friendshipId");
    }

    // friends_added tier 1 unlocks at 1 accepted friendship (see SERIES in
    // packages/shared/src/achievements/definitions.ts).
    const acceptResponse = await app.request(
      `/friends/request/${sendJson.friendshipId}/accept`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${addressee.token}` },
      },
    );
    expect(acceptResponse.status).toBe(200);
    const acceptJson = await acceptResponse.json();
    expect(acceptJson).not.toHaveProperty("unlocked");

    await expectUnlockPersisted(supabaseAdmin, addressee.id, "friends_added.t1");

    await supabaseAdmin
      .from("friendships")
      .delete()
      .eq("requester_id", requester.id)
      .eq("addressee_id", addressee.id);
    await supabaseAdmin.auth.admin.deleteUser(requester.id).catch(() => undefined);
    await supabaseAdmin.auth.admin.deleteUser(addressee.id).catch(() => undefined);
  });

  it("POST /groups persists the created_group unlock without changing the response", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const user = await createTestUser();
    const festival = await createTestFestival(supabaseAdmin);
    const app = mountRoute(groupRoutes);

    const response = await app.request("/groups", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Created Group Unlock ${randomUUID()}`, festivalId: festival.id }),
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).not.toHaveProperty("unlocked");

    await expectUnlockPersisted(supabaseAdmin, user.id, "created_group");

    await supabaseAdmin.from("groups").delete().eq("created_by", user.id).eq("festival_id", festival.id);
    await supabaseAdmin.from("festivals").delete().eq("id", festival.id);
    await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => undefined);
  });

  it("POST /groups/{id}/join persists the groups_joined unlock without changing the response", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const creator = await createTestUser();
    const joiner = await createTestUser();
    const festival = await createTestFestival(supabaseAdmin);
    const app = mountRoute(groupRoutes);

    const { data: groupRows, error: groupError } = await supabaseAdmin.rpc(
      "create_group_with_member",
      {
        p_group_name: `Join Unlock Group ${randomUUID()}`,
        p_user_id: creator.id,
        p_festival_id: festival.id,
        p_winning_criteria_id: 2,
      },
    );
    if (groupError || !groupRows?.[0]) {
      throw new Error(`Failed to create test group: ${groupError?.message}`);
    }
    const groupId = groupRows[0].group_id;

    // groups_joined tier 1 unlocks at 1 group (see SERIES in
    // packages/shared/src/achievements/definitions.ts).
    const response = await app.request(`/groups/${groupId}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${joiner.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).not.toHaveProperty("unlocked");

    await expectUnlockPersisted(supabaseAdmin, joiner.id, "groups_joined.t1");

    await supabaseAdmin.from("groups").delete().eq("id", groupId);
    await supabaseAdmin.from("festivals").delete().eq("id", festival.id);
    await supabaseAdmin.auth.admin.deleteUser(creator.id).catch(() => undefined);
    await supabaseAdmin.auth.admin.deleteUser(joiner.id).catch(() => undefined);
  });

  it("POST /groups/join-by-token persists the groups_joined unlock without changing the response", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const creator = await createTestUser();
    const joiner = await createTestUser();
    const festival = await createTestFestival(supabaseAdmin);
    const app = mountRoute(groupRoutes);

    const { data: groupRows, error: groupError } = await supabaseAdmin.rpc(
      "create_group_with_member",
      {
        p_group_name: `Join By Token Unlock Group ${randomUUID()}`,
        p_user_id: creator.id,
        p_festival_id: festival.id,
        p_winning_criteria_id: 2,
      },
    );
    if (groupError || !groupRows?.[0]) {
      throw new Error(`Failed to create test group: ${groupError?.message}`);
    }
    const groupId = groupRows[0].group_id;

    // The set_group_token BEFORE INSERT trigger (see generate_group_token in
    // supabase/migrations/20260103025746_cleanup_deprecated_objects.sql)
    // overwrites invite_token on every insert, so the value
    // create_group_with_member's RETURN QUERY reports is stale. Read the
    // token that actually persisted instead of trusting the RPC's return.
    const { data: persistedGroup, error: persistedGroupError } = await supabaseAdmin
      .from("groups")
      .select("invite_token")
      .eq("id", groupId)
      .single();
    if (persistedGroupError || !persistedGroup?.invite_token) {
      throw new Error(`Failed to read persisted invite token: ${persistedGroupError?.message}`);
    }
    const inviteToken = persistedGroup.invite_token;

    const response = await app.request("/groups/join-by-token", {
      method: "POST",
      headers: { Authorization: `Bearer ${joiner.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inviteToken }),
    });
    expect(response.status).toBe(200);
    const json = (await response.json()) as { group?: { id?: string } };
    expect(json).not.toHaveProperty("unlocked");
    expect(json.group?.id).toBe(groupId);

    await expectUnlockPersisted(supabaseAdmin, joiner.id, "groups_joined.t1");

    await supabaseAdmin.from("groups").delete().eq("id", groupId);
    await supabaseAdmin.from("festivals").delete().eq("id", festival.id);
    await supabaseAdmin.auth.admin.deleteUser(creator.id).catch(() => undefined);
    await supabaseAdmin.auth.admin.deleteUser(joiner.id).catch(() => undefined);
  });

  it("POST /tents/{tentId}/crowd-report persists the unlock without changing the response", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const user = await createTestUser();
    const festival = await createTestFestival(supabaseAdmin);
    const app = mountRoute(crowdReportRoutes);

    const { data: tent, error: tentError } = await supabaseAdmin
      .from("tents")
      .insert({ id: randomUUID(), name: "Crowd Report Unlock Tent", category: "large" })
      .select()
      .single();
    if (tentError || !tent) {
      throw new Error(`Failed to create test tent: ${tentError?.message}`);
    }

    // crowd_reports tier 1 unlocks at 1 report (see SERIES in
    // packages/shared/src/achievements/definitions.ts).
    const response = await app.request(`/tents/${tent.id}/crowd-report`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ festivalId: festival.id, crowdLevel: "moderate" }),
    });
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json).not.toHaveProperty("unlocked");

    await expectUnlockPersisted(supabaseAdmin, user.id, "crowd_reports.t1");

    await supabaseAdmin.from("tent_crowd_reports").delete().eq("tent_id", tent.id);
    await supabaseAdmin.from("tents").delete().eq("id", tent.id);
    await supabaseAdmin.from("festivals").delete().eq("id", festival.id);
    await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => undefined);
  });

  it("PUT /profile persists the profile_complete unlock without changing the response", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const user = await createTestUser();
    const app = mountRoute(profileRoutes);

    // profile_complete requires username, full_name and avatar_url all set
    // (see get_achievement_metrics in
    // supabase/migrations/20260805120828_achievement_metrics_function.sql).
    // Pre-set the avatar directly so this PUT supplies the last missing field.
    await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: "unlock-test-avatar.webp" })
      .eq("id", user.id);

    const response = await app.request("/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `unlock-${randomUUID().slice(0, 8)}`,
        full_name: "Profile Unlock Tester",
      }),
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).not.toHaveProperty("unlocked");

    await expectUnlockPersisted(supabaseAdmin, user.id, "profile_complete");

    await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => undefined);
  });

  it("POST /profile/avatar/confirm persists the profile_complete unlock without changing the response", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const user = await createTestUser();
    const app = mountRoute(profileRoutes);

    // Pre-set username and full_name so this confirm call supplies the last
    // missing field for profile_complete.
    await supabaseAdmin
      .from("profiles")
      .update({
        username: `unlock-${randomUUID().slice(0, 8)}`,
        full_name: "Avatar Unlock Tester",
      })
      .eq("id", user.id);

    const response = await app.request("/profile/avatar/confirm", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "unlock-test-avatar-2.webp" }),
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ success: true, fileName: "unlock-test-avatar-2.webp" });

    await expectUnlockPersisted(supabaseAdmin, user.id, "profile_complete");

    await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => undefined);
  });

  it("GET /wrapped/{festivalId} persists the wrapped_viewed unlock without changing the response", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const user = await createTestUser();
    const festival = await createTestFestival(supabaseAdmin);
    const app = mountRoute(wrappedRoutes);

    // wrapped_viewed is read off wrapped_data_cache.first_viewed_at (see
    // get_achievement_metrics). Nothing in this codebase writes that column
    // yet, so the cache row is seeded directly here to simulate a prior view;
    // this test only exercises the evaluate-only wiring on the read path.
    const { error: cacheError } = await supabaseAdmin.from("wrapped_data_cache").insert({
      user_id: user.id,
      festival_id: festival.id,
      wrapped_data: {},
      generated_by: "system",
      first_viewed_at: new Date().toISOString(),
    });
    if (cacheError) {
      throw new Error(`Failed to seed wrapped_data_cache: ${cacheError.message}`);
    }

    const response = await app.request(`/wrapped/${festival.id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).not.toHaveProperty("unlocked");

    await expectUnlockPersisted(supabaseAdmin, user.id, "wrapped_viewed");

    await supabaseAdmin
      .from("wrapped_data_cache")
      .delete()
      .eq("user_id", user.id)
      .eq("festival_id", festival.id);
    await supabaseAdmin.from("festivals").delete().eq("id", festival.id);
    await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => undefined);
  });
});
