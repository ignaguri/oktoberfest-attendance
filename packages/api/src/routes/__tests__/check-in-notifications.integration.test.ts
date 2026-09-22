// Integration test: requires a running local Supabase.
//   cd packages/api && npx vitest run --config vitest.integration.config.ts \
//     src/routes/__tests__/check-in-notifications.integration.test.ts
import { randomUUID } from "crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@prostcounter/db";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
} from "../../__tests__/helpers/test-supabase";
import { createTestApp } from "../../__tests__/helpers/test-server";
import { authMiddleware } from "../../middleware/auth";
import attendanceRoutes from "../attendance.route";
import consumptionRoutes from "../consumption.route";

// Stub the service so nothing reaches Novu and the calls are observable.
const { notifyDayStartMock, notifyTentCheckinMock } = vi.hoisted(() => ({
  notifyDayStartMock: vi.fn(),
  notifyTentCheckinMock: vi.fn(),
}));

vi.mock("../../services/notification.service", () => ({
  NotificationService: class {
    notifyDayStart = notifyDayStartMock;
    notifyTentCheckin = notifyTentCheckinMock;
  },
}));

// Created lazily in beforeAll, not at module scope: setup.ts loads the local
// Supabase env vars from .env.test/.env.local inside a beforeAll hook, which
// runs after this file's top-level code, so building the admin client at
// import time reads env vars before they exist.
let admin: SupabaseClient<Database>;
const createdUserIds: string[] = [];
const createdFestivalIds: string[] = [];
const createdGroupIds: string[] = [];
// Restored in afterAll rather than just re-set, so this file doesn't leak a
// key into whatever test happens to share the process afterwards.
const originalNovuApiKey = process.env.NOVU_API_KEY;

function mountRoutes() {
  const app = createTestApp();
  app.use("*", authMiddleware);
  app.route("/", attendanceRoutes);
  return app;
}

function mountConsumptionRoutes() {
  const app = createTestApp();
  app.use("*", authMiddleware);
  app.route("/", consumptionRoutes);
  return app;
}

async function createTestUser() {
  const anon = createTestSupabaseAnon();
  const { data, error } = await anon.auth.signUp({
    email: `check-in-${randomUUID()}@integration-test.com`,
    password: "test-password-123!",
  });
  if (error || !data.user || !data.session) {
    throw new Error(`Failed to create test user: ${error?.message ?? "unknown error"}`);
  }
  createdUserIds.push(data.user.id);
  return { id: data.user.id, token: data.session.access_token };
}

async function createTestFestival() {
  const suffix = randomUUID();
  const { data, error } = await admin
    .from("festivals")
    .insert({
      name: `Check-in Test Festival ${suffix}`,
      short_name: `check-in-${suffix}`.slice(0, 40),
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
  if (error || !data) {
    throw new Error(`Failed to create test festival: ${error?.message}`);
  }
  createdFestivalIds.push(data.id);
  return data.id;
}

async function anyTentId() {
  const { data, error } = await admin.from("tents").select("id").limit(1).single();
  if (error || !data) {
    throw new Error(`No tents in the local database: ${error?.message}`);
  }
  return data.id;
}

// Puts the acting user in a group for the festival, which is the only thing
// groupIdsForFestival needs to make the tent check-in fallback (as opposed to
// day-start) actually run. NotificationService itself is mocked, so no other
// member is needed to observe the call.
async function putUserInGroup(userId: string, festivalId: string) {
  const { data: group, error: groupError } = await admin.rpc("create_group_with_member", {
    p_group_name: `Check-in Test Group ${randomUUID()}`,
    p_user_id: userId,
    p_festival_id: festivalId,
    p_winning_criteria_id: 2,
  });
  if (groupError || !group?.[0]) {
    throw new Error(`Failed to create test group: ${groupError?.message}`);
  }
  createdGroupIds.push(group[0].group_id);
}

// A confirmed tent reservation, the minimum row day_plans_reservation_fields
// accepts (kind='reservation' requires tent_id, start_at, status,
// reminder_offset_minutes and auto_checkin all set). Cascades away with its
// festival, so no separate cleanup is tracked.
async function createTestReservation(userId: string, festivalId: string, tentId: string) {
  const { data, error } = await admin
    .from("day_plans")
    .insert({
      user_id: userId,
      festival_id: festivalId,
      date: "2024-09-21",
      kind: "reservation",
      tent_id: tentId,
      start_at: "2024-09-21T18:00:00.000Z",
      status: "confirmed",
      reminder_offset_minutes: 30,
      auto_checkin: false,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create test reservation: ${error?.message}`);
  }
  return data.id;
}

describe("check-in notifications reach the endpoints mobile actually calls", () => {
  beforeAll(() => {
    admin = createTestSupabaseAdmin();
  });

  afterAll(async () => {
    if (createdGroupIds.length > 0) {
      await admin.from("group_members").delete().in("group_id", createdGroupIds);
      await admin.from("groups").delete().in("id", createdGroupIds);
    }
    for (const festivalId of createdFestivalIds) {
      await admin.from("festivals").delete().eq("id", festivalId);
    }
    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    if (originalNovuApiKey === undefined) {
      delete process.env.NOVU_API_KEY;
    } else {
      process.env.NOVU_API_KEY = originalNovuApiKey;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOVU_API_KEY = "test-novu-key";
    notifyDayStartMock.mockResolvedValue(true);
  });

  afterEach(() => {
    if (originalNovuApiKey === undefined) {
      delete process.env.NOVU_API_KEY;
    } else {
      process.env.NOVU_API_KEY = originalNovuApiKey;
    }
  });

  // The regression. Mobile has logged tent visits through this endpoint since
  // it went offline-first in 132f37bd; nothing here ever notified anyone, which
  // is why tent-check-in-notification last fired on 2026-04-09.
  it("notifies day start and does not also send a tent check-in", async () => {
    const app = mountRoutes();
    const user = await createTestUser();
    const festivalId = await createTestFestival();
    const tentId = await anyTentId();
    // A real group membership so the single-push rule has a fallback to
    // wrongly fire if it fails: with it in place, an implementation that
    // sent both pushes would still pass a test that only asserts
    // notifyDayStartMock was called.
    await putUserInGroup(user.id, festivalId);

    const response = await app.request("/attendance/tent-visits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        festivalId,
        tentId,
        visitedAt: new Date("2024-09-21T18:00:00.000Z").toISOString(),
      }),
    });

    expect(response.status).toBe(201);
    expect(notifyDayStartMock).toHaveBeenCalledTimes(1);
    expect(notifyTentCheckinMock).not.toHaveBeenCalled();
  });

  // The single-push rule: once the day is claimed, a check-in is an ordinary
  // tent check-in and must not also announce the day. The fixture needs a
  // real group membership, otherwise the fallback branch never runs and this
  // test would pass even if it had been deleted outright.
  it("falls back to a tent check-in once the day is already claimed", async () => {
    notifyDayStartMock.mockResolvedValue(false);

    const app = mountRoutes();
    const user = await createTestUser();
    const festivalId = await createTestFestival();
    const tentId = await anyTentId();
    await putUserInGroup(user.id, festivalId);

    const response = await app.request("/attendance/tent-visits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        festivalId,
        tentId,
        visitedAt: new Date("2024-09-21T18:00:00.000Z").toISOString(),
      }),
    });

    expect(response.status).toBe(201);
    expect(notifyDayStartMock).toHaveBeenCalledTimes(1);
    expect(notifyDayStartMock).toHaveBeenCalledWith(expect.objectContaining({ kind: "checkin" }));
    expect(notifyTentCheckinMock).toHaveBeenCalledTimes(1);
  });

  // A replayed push (same tentVisitId, at-least-once offline sync queue)
  // inserts nothing on the second call. The original call already made the
  // single-push decision for this visit; replaying it must not make a
  // second one of either kind.
  it("does not send a second notification when a tent visit is replayed", async () => {
    const app = mountRoutes();
    const user = await createTestUser();
    const festivalId = await createTestFestival();
    const tentId = await anyTentId();
    await putUserInGroup(user.id, festivalId);
    const tentVisitId = randomUUID();

    const body = JSON.stringify({
      festivalId,
      tentId,
      visitedAt: new Date("2024-09-21T18:00:00.000Z").toISOString(),
      tentVisitId,
    });

    const first = await app.request("/attendance/tent-visits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
      body,
    });
    expect(first.status).toBe(201);
    expect(notifyDayStartMock).toHaveBeenCalledTimes(1);

    const replay = await app.request("/attendance/tent-visits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
      body,
    });
    expect(replay.status).toBe(201);

    // Still 1, not 2 — the replay announced nothing.
    expect(notifyDayStartMock).toHaveBeenCalledTimes(1);
    expect(notifyTentCheckinMock).not.toHaveBeenCalled();
  });

  // Constraint: the ledger date must come from the repository's
  // festival-timezone bucketing, never from slicing the incoming UTC
  // timestamp. 23:30 UTC is already the next day in Europe/Berlin (UTC+2 in
  // September), so a regression to `visitedAt.slice(0, 10)` would report the
  // 21st here instead of the 22nd and this assertion would catch it.
  it("buckets the notified date by festival timezone, not by slicing the UTC timestamp", async () => {
    const app = mountRoutes();
    const user = await createTestUser();
    const festivalId = await createTestFestival();
    const tentId = await anyTentId();

    const response = await app.request("/attendance/tent-visits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        festivalId,
        tentId,
        visitedAt: new Date("2024-09-21T23:30:00.000Z").toISOString(),
      }),
    });

    expect(response.status).toBe(201);
    expect(notifyDayStartMock).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2024-09-22" }),
    );
  });

  // Important 2's fix: mobile resends the whole day's tent set on every save
  // (push-handlers.ts:28), so gating on "the request has tents" announces on
  // every save. Gating on the RPC's own tentsAdded diff must announce once,
  // on the save that actually adds a tent, and not again on an identical
  // resave.
  it("/attendance/personal announces only on an actual tent change", async () => {
    const app = mountRoutes();
    const user = await createTestUser();
    const festivalId = await createTestFestival();
    const tentId = await anyTentId();
    await putUserInGroup(user.id, festivalId);

    const requestBody = JSON.stringify({
      festivalId,
      date: "2024-09-21",
      tents: [tentId],
    });

    const first = await app.request("/attendance/personal", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
      body: requestBody,
    });
    expect(first.status).toBe(200);
    expect(notifyDayStartMock).toHaveBeenCalledTimes(1);

    // Same tent set again — tentsAdded is empty this time, so nothing should
    // be sent. Reusing the mocks from the first call (no vi.clearAllMocks in
    // between) so a regression back to `data.tents.length > 0` shows up as a
    // second call here.
    const second = await app.request("/attendance/personal", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
      body: requestBody,
    });
    expect(second.status).toBe(200);

    expect(notifyDayStartMock).toHaveBeenCalledTimes(1);
    expect(notifyTentCheckinMock).not.toHaveBeenCalled();
  });

  // Important 4's fix: POST /attendance/check-in/{reservationId} is a real
  // tent check-in — the notification the user originally reported never
  // receiving — and the plan's four-endpoint enumeration missed it entirely.
  it("POST /attendance/check-in/{reservationId} announces", async () => {
    const app = mountRoutes();
    const user = await createTestUser();
    const festivalId = await createTestFestival();
    const tentId = await anyTentId();
    const reservationId = await createTestReservation(user.id, festivalId, tentId);

    const response = await app.request(`/attendance/check-in/${reservationId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    });

    expect(response.status).toBe(200);
    expect(notifyDayStartMock).toHaveBeenCalledTimes(1);
    // The date comes from the stored visit (festival-timezone-bucketed),
    // not from slicing the reservation's start_at directly.
    expect(notifyDayStartMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "checkin", date: "2024-09-21" }),
    );
  });

  // Fix-wave item 4.3: the plan's enumeration of hook points missed the plain
  // create/update endpoint entirely. Deleting the announceCheckIn call from
  // the POST /attendance handler would pass every other test in this suite.
  it("POST /attendance announces day start on first attendance with tents", async () => {
    const app = mountRoutes();
    const user = await createTestUser();
    const festivalId = await createTestFestival();
    const tentId = await anyTentId();
    await putUserInGroup(user.id, festivalId);

    const response = await app.request("/attendance", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        festivalId,
        date: "2024-09-21",
        tents: [tentId],
      }),
    });

    expect(response.status).toBe(200);
    expect(notifyDayStartMock).toHaveBeenCalledTimes(1);
    expect(notifyDayStartMock).toHaveBeenCalledWith(expect.objectContaining({ kind: "checkin" }));
  });

  // Fix-wave item 4.3: POST /consumption calls notifyDayStart directly
  // (not through announceCheckIn) and had no coverage at all. Deleting the
  // notifyDayStart block from consumption.route.ts would pass every other
  // test in the suite.
  it("POST /consumption announces day start on first drink", async () => {
    const app = mountConsumptionRoutes();
    const user = await createTestUser();
    const festivalId = await createTestFestival();

    const response = await app.request("/consumption", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        festivalId,
        date: "2024-09-21",
        drinkType: "beer",
      }),
    });

    expect(response.status).toBe(200);
    expect(notifyDayStartMock).toHaveBeenCalledTimes(1);
    expect(notifyDayStartMock).toHaveBeenCalledWith(expect.objectContaining({ kind: "drink" }));
  });
});
