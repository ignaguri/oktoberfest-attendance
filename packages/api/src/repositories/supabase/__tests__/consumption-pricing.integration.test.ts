import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { SupabaseConsumptionRepository } from "../consumption.repository";
import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";

/**
 * The server is the only thing that decides what a drink cost.
 *
 * Every client used to send one drink-type-agnostic price for every button, so
 * a soft drink was logged at the beer price: production held two Spezis at
 * 15.80 with a 9.48 tip. These tests pin the resolution down at the layer that
 * now owns it, against the real cascade function and the real profile row.
 */
describe("Consumption pricing resolution (Local DB)", () => {
  let supabaseAdmin: SupabaseClient<Database>;
  let userClient: SupabaseClient<Database>;
  let repo: SupabaseConsumptionRepository;

  let testUser: { id: string; token: string };
  let festivalId: string;
  let plainTentId: string;
  let pricyTentId: string;
  let attendanceId: string;

  const BEER_CENTS = 1580;
  const SOFT_DRINK_CENTS = 632;
  const PRICY_TENT_BEER_CENTS = 1840;

  beforeAll(async () => {
    supabaseAdmin = createTestSupabaseAdmin();
    const anon = createTestSupabaseAnon();

    const email = `pricing-${Date.now()}@integration-test.com`;
    const { data: authData, error: authError } = await anon.auth.signUp({
      email,
      password: "test-password-123!",
    });

    if (authError || !authData.user || !authData.session) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    testUser = { id: authData.user.id, token: authData.session.access_token };
    userClient = createTestSupabaseWithAuth(testUser.token);
    repo = new SupabaseConsumptionRepository(userClient);

    const { data: festival, error: festivalError } = await supabaseAdmin
      .from("festivals")
      .insert({
        name: `Pricing Test Festival ${Date.now()}`,
        short_name: `price-${Date.now()}`,
        festival_type: "oktoberfest",
        start_date: "2024-09-21",
        end_date: "2024-10-06",
        beer_cost: 15.8,
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
    festivalId = festival.id;

    // A festival-level price sheet, the shape production actually has.
    await supabaseAdmin.from("drink_type_prices").insert([
      { festival_id: festivalId, drink_type: "beer", price_cents: BEER_CENTS },
      { festival_id: festivalId, drink_type: "soft_drink", price_cents: SOFT_DRINK_CENTS },
    ]);

    // Two tents: one with no price of its own, one dearer than the festival.
    const { data: tents, error: tentError } = await supabaseAdmin
      .from("tents")
      .insert([
        { id: randomUUID(), name: `Plain Tent ${Date.now()}`, category: "large" },
        { id: randomUUID(), name: `Pricy Tent ${Date.now()}`, category: "large" },
      ])
      .select();

    if (tentError || !tents || tents.length !== 2) {
      throw new Error(`Failed to create test tents: ${tentError?.message}`);
    }
    plainTentId = tents[0].id;
    pricyTentId = tents[1].id;

    await supabaseAdmin.from("festival_tents").insert([
      { festival_id: festivalId, tent_id: plainTentId },
      {
        festival_id: festivalId,
        tent_id: pricyTentId,
        beer_price: PRICY_TENT_BEER_CENTS / 100,
        beer_price_cents: PRICY_TENT_BEER_CENTS,
      },
    ]);

    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from("attendances")
      .insert({ user_id: testUser.id, festival_id: festivalId, date: "2024-09-22" })
      .select()
      .single();

    if (attendanceError || !attendance) {
      throw new Error(`Failed to create test attendance: ${attendanceError?.message}`);
    }
    attendanceId = attendance.id;
  });

  beforeEach(async () => {
    await supabaseAdmin.from("consumptions").delete().eq("attendance_id", attendanceId);
    await setTipMode("ceiling_plus_1", null);
  });

  afterAll(async () => {
    await supabaseAdmin.from("consumptions").delete().eq("attendance_id", attendanceId);
    await supabaseAdmin.from("attendances").delete().eq("festival_id", festivalId);
    await supabaseAdmin.from("drink_type_prices").delete().eq("festival_id", festivalId);
    await supabaseAdmin.from("festival_tents").delete().eq("festival_id", festivalId);
    await supabaseAdmin.from("tents").delete().in("id", [plainTentId, pricyTentId]);
    await supabaseAdmin.from("festivals").delete().eq("id", festivalId);
    await supabaseAdmin.auth.admin.deleteUser(testUser.id);
  });

  type LogInput = Parameters<SupabaseConsumptionRepository["create"]>[2];

  /** Logs against the shared attendance, defaulting the fields pricing ignores. */
  function logDrink(input: Omit<LogInput, "volumeMl"> & { volumeMl?: number }) {
    return repo.create(testUser.id, attendanceId, { volumeMl: 1000, ...input });
  }

  async function setTipMode(mode: string, fixedAmount: number | null) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ tip_mode: mode, tip_fixed_amount: fixedAmount })
      .eq("id", testUser.id);

    if (error) {
      throw new Error(`Failed to set tip mode: ${error.message}`);
    }
  }

  describe("base price comes from the cascade, never from the client", () => {
    it("logs a soft drink at the soft drink price", async () => {
      const consumption = await logDrink({
        drinkType: "soft_drink",
        tentId: plainTentId,
      });

      expect(consumption.basePriceCents).toBe(SOFT_DRINK_CENTS);
    });

    it("discards the beer-derived prices an older client sends", async () => {
      // Exactly the payload that produced the 15.80 Spezi in production.
      const consumption = await logDrink({
        drinkType: "soft_drink",
        tentId: plainTentId,
        basePriceCents: BEER_CENTS,
        pricePaidCents: BEER_CENTS,
      });

      expect(consumption.basePriceCents).toBe(SOFT_DRINK_CENTS);
      expect(consumption.pricePaidCents).not.toBe(BEER_CENTS);
    });

    it("prefers a tent's own beer price over the festival price", async () => {
      const consumption = await logDrink({
        drinkType: "beer",
        tentId: pricyTentId,
      });

      expect(consumption.basePriceCents).toBe(PRICY_TENT_BEER_CENTS);
    });

    it("leaves a soft drink at the festival price even in a dearer tent", async () => {
      const consumption = await logDrink({
        drinkType: "soft_drink",
        tentId: pricyTentId,
      });

      expect(consumption.basePriceCents).toBe(SOFT_DRINK_CENTS);
    });
  });

  describe("the tip comes from the user's saved preference", () => {
    it("rounds up and adds one euro under ceiling_plus_1", async () => {
      const consumption = await logDrink({ drinkType: "beer" });

      // ceil(15.80) + 1 = 17.00
      expect(consumption.pricePaidCents).toBe(1700);
      expect(consumption.tipCents).toBe(1700 - BEER_CENTS);
    });

    it("anchors the tip to the drink's own price, not the beer price", async () => {
      const consumption = await logDrink({
        drinkType: "soft_drink",
      });

      // ceil(6.32) + 1 = 8.00, against the 15.80 + 9.48 tip production recorded.
      expect(consumption.pricePaidCents).toBe(800);
      expect(consumption.tipCents).toBe(800 - SOFT_DRINK_CENTS);
    });

    it("pays exactly the base price when tipping is off", async () => {
      await setTipMode("none", null);

      const consumption = await logDrink({ drinkType: "beer" });

      expect(consumption.pricePaidCents).toBe(BEER_CENTS);
      expect(consumption.tipCents).toBe(0);
    });

    it("adds a fixed amount under the fixed mode", async () => {
      await setTipMode("fixed", 2.5);

      const consumption = await logDrink({ drinkType: "beer" });

      expect(consumption.pricePaidCents).toBe(BEER_CENTS + 250);
    });
  });

  describe("an explicit override replaces the tip calculation", () => {
    it("stores the amount the user typed", async () => {
      const consumption = await logDrink({
        drinkType: "soft_drink",
        pricePaidOverrideCents: 700,
      });

      expect(consumption.basePriceCents).toBe(SOFT_DRINK_CENTS);
      expect(consumption.pricePaidCents).toBe(700);
    });

    it("rejects an override below the resolved base price", async () => {
      await expect(
        logDrink({
          drinkType: "beer",
          pricePaidOverrideCents: 100,
        }),
      ).rejects.toThrow();
    });
  });
});
