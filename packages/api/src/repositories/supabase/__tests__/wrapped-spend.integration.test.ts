import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";

/**
 * Wrapped's spend figure.
 *
 * It used to be `total_beers * festivals.beer_cost`, which was true back when
 * every festival really was flat rate and stopped being true once tents set
 * their own prices, users tipped, and soft drinks existed. These assertions
 * exist so it cannot quietly drift back: the number has to come from what was
 * actually charged.
 *
 * SQL, so it needs a real database.
 */
describe("Wrapped spend (Local DB)", () => {
  let supabaseAdmin: SupabaseClient<Database>;

  let userId: string;
  let accessToken: string;
  let festivalId: string;
  let tentId: string;
  let attendanceId: string;

  const FESTIVAL_BEER_COST = 15.8;
  const TENT_BEER_CENTS = 1840;
  const SOFT_DRINK_CENTS = 632;
  const TIP_CENTS = 60;

  // Two beers at the tent's price with a tip each, plus one soft drink.
  const BEER_PAID = TENT_BEER_CENTS + TIP_CENTS;
  const EXPECTED_CENTS = BEER_PAID * 2 + SOFT_DRINK_CENTS;

  beforeAll(async () => {
    supabaseAdmin = createTestSupabaseAdmin();
    const anon = createTestSupabaseAnon();

    const { data: authData, error: authError } = await anon.auth.signUp({
      email: `wrapped-spend-${Date.now()}@integration-test.com`,
      password: "test-password-123!",
    });
    if (authError || !authData.user || !authData.session) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }
    userId = authData.user.id;
    accessToken = authData.session.access_token;

    const { data: festival, error: festivalError } = await supabaseAdmin
      .from("festivals")
      .insert({
        name: `Wrapped Spend ${Date.now()}`,
        short_name: `wspend-${Date.now()}`,
        festival_type: "oktoberfest",
        start_date: "2024-09-21",
        end_date: "2024-10-06",
        beer_cost: FESTIVAL_BEER_COST,
        location: "Test Location",
        timezone: "Europe/Berlin",
        is_active: false,
        status: "ended",
      })
      .select()
      .single();
    if (festivalError || !festival) {
      throw new Error(`Failed to create festival: ${festivalError?.message}`);
    }
    festivalId = festival.id;

    const { data: tent, error: tentError } = await supabaseAdmin
      .from("tents")
      .insert({ id: randomUUID(), name: `Wrapped Tent ${Date.now()}`, category: "large" })
      .select()
      .single();
    if (tentError || !tent) {
      throw new Error(`Failed to create tent: ${tentError?.message}`);
    }
    tentId = tent.id;

    await supabaseAdmin
      .from("festival_tents")
      .insert({ festival_id: festivalId, tent_id: tentId, beer_price_cents: TENT_BEER_CENTS });

    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from("attendances")
      .insert({ user_id: userId, festival_id: festivalId, date: "2024-09-22", beer_count: 2 })
      .select()
      .single();
    if (attendanceError || !attendance) {
      throw new Error(`Failed to create attendance: ${attendanceError?.message}`);
    }
    attendanceId = attendance.id;

    const { error: consumptionError } = await supabaseAdmin.from("consumptions").insert([
      {
        attendance_id: attendanceId,
        tent_id: tentId,
        drink_type: "beer",
        base_price_cents: TENT_BEER_CENTS,
        price_paid_cents: BEER_PAID,
        volume_ml: 1000,
      },
      {
        attendance_id: attendanceId,
        tent_id: tentId,
        drink_type: "beer",
        base_price_cents: TENT_BEER_CENTS,
        price_paid_cents: BEER_PAID,
        volume_ml: 1000,
      },
      {
        attendance_id: attendanceId,
        tent_id: tentId,
        drink_type: "soft_drink",
        base_price_cents: SOFT_DRINK_CENTS,
        price_paid_cents: SOFT_DRINK_CENTS,
        volume_ml: 500,
      },
    ]);
    if (consumptionError) {
      throw new Error(`Failed to create consumptions: ${consumptionError.message}`);
    }
  });

  afterAll(async () => {
    await supabaseAdmin.from("consumptions").delete().eq("attendance_id", attendanceId);
    await supabaseAdmin.from("attendances").delete().eq("id", attendanceId);
    await supabaseAdmin.from("festival_tents").delete().eq("festival_id", festivalId);
    await supabaseAdmin.from("festivals").delete().eq("id", festivalId);
    await supabaseAdmin.from("tents").delete().eq("id", tentId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
  });

  async function getWrapped() {
    const { data, error } = await supabaseAdmin.rpc("get_wrapped_data", {
      p_user_id: userId,
      p_festival_id: festivalId,
    });
    if (error) {
      throw new Error(`get_wrapped_data failed: ${error.message}`);
    }
    return data as Record<string, any>;
  }

  it("totals what was actually paid, tips and soft drinks included", async () => {
    const wrapped = await getWrapped();

    expect(wrapped.basic_stats.total_spent).toBeCloseTo(EXPECTED_CENTS / 100, 2);
  });

  it("does not price the day at the festival's flat beer cost", async () => {
    const wrapped = await getWrapped();
    const flatRateGuess = wrapped.basic_stats.total_beers * FESTIVAL_BEER_COST;

    expect(wrapped.basic_stats.total_spent).not.toBeCloseTo(flatRateGuess, 2);
  });

  it("still reports the festival's headline beer cost", async () => {
    const wrapped = await getWrapped();

    expect(Number(wrapped.basic_stats.beer_cost)).toBeCloseTo(FESTIVAL_BEER_COST, 2);
  });

  it("reconciles the timeline against the total", async () => {
    const wrapped = await getWrapped();
    const timelineSum = (wrapped.timeline as Array<{ spent: number }>).reduce(
      (sum, day) => sum + Number(day.spent),
      0,
    );

    expect(timelineSum).toBeCloseTo(wrapped.basic_stats.total_spent, 2);
  });

  it("prices the most expensive day off the same source", async () => {
    const wrapped = await getWrapped();

    expect(Number(wrapped.peak_moments.most_expensive_day.amount)).toBeCloseTo(
      EXPECTED_CENTS / 100,
      2,
    );
  });

  it("keeps the spend helper away from signed-in clients", async () => {
    // SECURITY DEFINER on a bare attendance id, so a grant to `authenticated`
    // would hand any signed-in user anyone else's spend. Supabase's default
    // privileges grant new functions to anon and authenticated at creation, so
    // this is the assertion that the migration's explicit REVOKEs stuck.
    const authed = createTestSupabaseWithAuth(accessToken);

    const { error } = await authed.rpc("_get_effective_spend_cents" as never, {
      p_attendance_id: attendanceId,
    } as never);

    expect(error).not.toBeNull();
    expect(`${error?.message} ${error?.code}`).toMatch(/permission denied|PGRST202|42501/i);
  });

  it("lets service_role call the helper, which is how Wrapped reaches it", async () => {
    const { data, error } = await supabaseAdmin.rpc("_get_effective_spend_cents" as never, {
      p_attendance_id: attendanceId,
    } as never);

    expect(error).toBeNull();
    expect(Number(data)).toBe(EXPECTED_CENTS);
  });
});
