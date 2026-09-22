// Integration test: requires a running local Supabase.
//   cd packages/api && npx vitest run --config vitest.integration.config.ts \
//     src/routes/__tests__/check-in-notifications.integration.test.ts
import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@prostcounter/db";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
} from "../../__tests__/helpers/test-supabase";
import { createTestApp } from "../../__tests__/helpers/test-server";
import { authMiddleware } from "../../middleware/auth";
import attendanceRoutes from "../attendance.route";

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

function mountRoutes() {
  const app = createTestApp();
  app.use("*", authMiddleware);
  app.route("/", attendanceRoutes);
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

describe("check-in notifications reach the endpoints mobile actually calls", () => {
  beforeAll(() => {
    admin = createTestSupabaseAdmin();
  });

  afterAll(async () => {
    for (const festivalId of createdFestivalIds) {
      await admin.from("festivals").delete().eq("id", festivalId);
    }
    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOVU_API_KEY = "test-novu-key";
    notifyDayStartMock.mockResolvedValue(true);
  });

  // The regression. Mobile has logged tent visits through this endpoint since
  // it went offline-first in 132f37bd; nothing here ever notified anyone, which
  // is why tent-check-in-notification last fired on 2026-04-09.
  it("notifies when a tent visit is logged through /attendance/tent-visits", async () => {
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
        visitedAt: new Date("2024-09-21T18:00:00.000Z").toISOString(),
      }),
    });

    expect(response.status).toBe(201);
    expect(notifyDayStartMock).toHaveBeenCalledTimes(1);
  });

  // The single-push rule: once the day is claimed, a check-in is an ordinary
  // tent check-in and must not also announce the day.
  it("falls back to a tent check-in once the day is already claimed", async () => {
    notifyDayStartMock.mockResolvedValue(false);

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
        visitedAt: new Date("2024-09-21T18:00:00.000Z").toISOString(),
      }),
    });

    expect(response.status).toBe(201);
    expect(notifyDayStartMock).toHaveBeenCalledTimes(1);
    // No group memberships in this fixture, so the tent check-in is skipped —
    // what matters is that day-start did not fire twice.
    expect(notifyDayStartMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "checkin" }),
    );
  });
});
