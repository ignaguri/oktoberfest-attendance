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
import photoRoutes from "../photo.route";

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
