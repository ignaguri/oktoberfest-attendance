// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test:integration -- admin-analytics
//
// Seeds its own users, festivals and activity in 1950 and 2998-2999, so the
// date-bounded metrics only ever see this file's rows on a shared local DB.
// The activation funnel is keyed on real sign-up dates (today), so it is
// asserted as a delta against a baseline taken before the users exist.
import { ANALYTICS_FEATURES } from "@prostcounter/shared";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";

const admin = createTestSupabaseAdmin();
const createdUserIds: string[] = [];
const createdFestivalIds: string[] = [];

interface SeedUser {
  id: string;
  token: string;
}

function tag(): string {
  return randomUUID().slice(0, 8);
}

async function signUp(email: string): Promise<SeedUser> {
  const { data, error } = await createTestSupabaseAnon().auth.signUp({
    email,
    password: "test-password-123!",
  });
  if (error || !data.user || !data.session) {
    throw new Error(`Failed to create ${email}: ${error?.message ?? "no session"}`);
  }
  createdUserIds.push(data.user.id);
  return { id: data.user.id, token: data.session.access_token };
}

async function createFestival(startDate: string, endDate: string): Promise<string> {
  const suffix = randomUUID().slice(0, 12);
  const { data, error } = await admin
    .from("festivals")
    .insert({
      name: `Analytics Test Festival ${suffix}`,
      short_name: `an-${suffix}`,
      festival_type: "oktoberfest",
      start_date: startDate,
      end_date: endDate,
      beer_cost: 16.2,
      location: "Test Location",
      timezone: "Europe/Berlin",
      is_active: false,
      status: "ended",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create festival: ${error?.message ?? "no data"}`);
  }
  createdFestivalIds.push(data.id);
  return data.id;
}

type FunnelCounts = Record<string, number>;

async function funnelFor(day: string): Promise<FunnelCounts> {
  const { data, error } = await admin.rpc("analytics_activation_funnel", {
    p_from: day,
    p_to: day,
  });
  if (error || !data) {
    throw new Error(`analytics_activation_funnel failed: ${error?.message ?? "no data"}`);
  }
  return Object.fromEntries(data.map((row) => [row.step, row.users]));
}

const today = new Date().toISOString().slice(0, 10);

let baselineFunnel: FunnelCounts;
let realA: SeedUser;
let festivalOne: string;
let festivalTwo: string;
let futureOne: string;

describe("analytics metric functions", () => {
  beforeAll(async () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Integration tests need local Supabase env vars; see the file header");
    }

    baselineFunnel = await funnelFor(today);

    realA = await signUp(`analytics-a-${tag()}@integration-test.com`);
    const realB = await signUp(`analytics-b-${tag()}@integration-test.com`);
    const realC = await signUp(`analytics-c-${tag()}@integration-test.com`);
    const seedAccount = await signUp(`analytics-seed-${tag()}@example.com`);
    const superAdmin = await signUp(`analytics-admin-${tag()}@integration-test.com`);

    const { error: promoteError } = await admin
      .from("profiles")
      .update({ is_super_admin: true })
      .eq("id", superAdmin.id);
    if (promoteError) {
      throw new Error(`Failed to promote admin: ${promoteError.message}`);
    }

    festivalOne = await createFestival("1950-01-10", "1950-01-12");
    festivalTwo = await createFestival("1950-02-10", "1950-02-12");
    futureOne = await createFestival("2998-01-01", "2998-01-03");
    await createFestival("2999-01-01", "2999-01-03");

    const attendances = [
      { user_id: realA.id, festival_id: festivalOne, date: "1950-01-10" },
      { user_id: realA.id, festival_id: festivalOne, date: "1950-01-11" },
      { user_id: realA.id, festival_id: festivalTwo, date: "1950-02-10" },
      { user_id: realA.id, festival_id: futureOne, date: "2998-01-01" },
      { user_id: realB.id, festival_id: festivalOne, date: "1950-01-11" },
      { user_id: realB.id, festival_id: festivalOne, date: "1950-01-12" },
      { user_id: realB.id, festival_id: festivalTwo, date: "1950-02-10" },
      { user_id: realB.id, festival_id: festivalTwo, date: "1950-02-11" },
      { user_id: realB.id, festival_id: festivalTwo, date: "1950-02-12" },
      { user_id: realC.id, festival_id: festivalOne, date: "1950-01-10" },
      { user_id: seedAccount.id, festival_id: festivalOne, date: "1950-01-10" },
      { user_id: superAdmin.id, festival_id: festivalOne, date: "1950-01-10" },
    ].map((row) => ({ ...row, beer_count: 1 }));
    const { error: attendanceError } = await admin.from("attendances").insert(attendances);
    if (attendanceError) {
      throw new Error(`Failed to seed attendances: ${attendanceError.message}`);
    }

    const activeDays = [
      { user_id: realA.id, day: "1950-01-10", platform: "android", app_version: "1.0.0" },
      { user_id: realA.id, day: "1950-01-11", platform: "android", app_version: "1.0.0" },
      { user_id: realB.id, day: "1950-01-11", platform: "ios", app_version: "1.0.0" },
      { user_id: seedAccount.id, day: "1950-01-11", platform: "ios", app_version: "1.0.0" },
      { user_id: superAdmin.id, day: "1950-01-11", platform: "ios", app_version: "1.0.0" },
    ];
    const { error: activeDayError } = await admin.from("user_active_days").insert(activeDays);
    if (activeDayError) {
      throw new Error(`Failed to seed active days: ${activeDayError.message}`);
    }
  });

  afterAll(async () => {
    if (createdFestivalIds.length > 0) {
      await admin.from("attendances").delete().in("festival_id", createdFestivalIds);
    }
    if (createdUserIds.length > 0) {
      await admin.from("user_active_days").delete().in("user_id", createdUserIds);
    }
    if (createdFestivalIds.length > 0) {
      await admin.from("festivals").delete().in("id", createdFestivalIds);
    }
    for (const userId of createdUserIds) {
      await admin.from("profiles").delete().eq("id", userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        console.warn(`Failed to delete test user ${userId}: ${error.message}`);
      }
    }
  });

  it("counts rolling DAU/WAU/MAU per day, excluding seed and admin accounts", async () => {
    const { data, error } = await admin.rpc("analytics_overview", {
      p_from: "1950-01-10",
      p_to: "1950-01-12",
    });

    expect(error).toBeNull();
    expect(data).toEqual([
      { day: "1950-01-10", dau: 1, wau: 1, mau: 1 },
      { day: "1950-01-11", dau: 2, wau: 2, mau: 2 },
      { day: "1950-01-12", dau: 0, wau: 2, mau: 2 },
    ]);
  });

  it("filters the overview by platform", async () => {
    const { data, error } = await admin.rpc("analytics_overview", {
      p_from: "1950-01-10",
      p_to: "1950-01-12",
      p_platform: "ios",
    });

    expect(error).toBeNull();
    expect(data).toEqual([
      { day: "1950-01-10", dau: 0, wau: 0, mau: 0 },
      { day: "1950-01-11", dau: 1, wau: 1, mau: 1 },
      { day: "1950-01-12", dau: 0, wau: 1, mau: 1 },
    ]);
  });

  it("returns one row per feature with domain usage and the active-user base", async () => {
    const { data, error } = await admin.rpc("analytics_feature_usage", {
      p_from: "1950-01-10",
      p_to: "1950-01-12",
    });

    expect(error).toBeNull();
    const rows = data ?? [];
    expect(new Set(rows.map((row) => row.feature))).toEqual(new Set(ANALYTICS_FEATURES));
    expect(rows).toHaveLength(ANALYTICS_FEATURES.length);
    expect(rows[0]).toEqual({ feature: "attendance", users: 3, events: 5, active_users: 2 });
    expect(
      rows
        .filter((row) => row.feature !== "attendance")
        .every((row) => row.users === 0 && row.events === 0 && row.active_users === 2),
    ).toBe(true);
  });

  it("computes festival-to-festival retention, pending when the next one has not started", async () => {
    const { data, error } = await admin.rpc("analytics_festival_retention");

    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows.find((row) => row.festival_id === festivalOne)).toMatchObject({
      attendees: 3,
      returned_next: 2,
      returned_any: 2,
    });
    expect(rows.find((row) => row.festival_id === festivalTwo)).toMatchObject({
      attendees: 2,
      returned_any: 1,
    });
    expect(rows.find((row) => row.festival_id === futureOne)).toMatchObject({
      attendees: 1,
      returned_next: null,
      returned_any: 0,
    });
  });

  it("orders festival retention newest first", async () => {
    const { data } = await admin.rpc("analytics_festival_retention");
    const startDates = (data ?? []).map((row) => row.start_date);
    expect(startDates).toEqual([...startDates].sort().reverse());
  });

  it("counts today's real sign-ups through the activation funnel", async () => {
    const after = await funnelFor(today);

    expect(Object.keys(after)).toEqual(["signed_up", "logged_attendance", "five_days"]);
    expect({
      signed_up: after.signed_up - baselineFunnel.signed_up,
      logged_attendance: after.logged_attendance - baselineFunnel.logged_attendance,
      five_days: after.five_days - baselineFunnel.five_days,
    }).toEqual({ signed_up: 3, logged_attendance: 3, five_days: 1 });
  });

  it("denies every metric function to signed-in users and anon", async () => {
    const userClient = createTestSupabaseWithAuth(realA.token);
    const anonClient = createTestSupabaseAnon();
    const range = { p_from: "1950-01-10", p_to: "1950-01-12" };

    const results = await Promise.all([
      userClient.rpc("analytics_overview", range),
      userClient.rpc("analytics_feature_usage", range),
      userClient.rpc("analytics_activation_funnel", range),
      userClient.rpc("analytics_festival_retention"),
      anonClient.rpc("analytics_overview", range),
    ]);

    for (const result of results) {
      expect(result.error?.code).toBe("42501");
    }
  });
});
