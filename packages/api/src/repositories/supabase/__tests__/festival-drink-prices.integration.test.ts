import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SupabaseFestivalRepository } from "../festival.repository";
import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";

/**
 * A festival now carries its whole price sheet, not just beerCost, so a client
 * can show what a soft drink costs instead of assuming beer.
 *
 * The embed is the part worth testing against a real database: drink_type_prices
 * holds both festival-scoped and tent-scoped rows, and only the festival-scoped
 * ones belong in this payload.
 */
describe("Festival drink prices (Local DB)", () => {
  let supabaseAdmin: SupabaseClient<Database>;
  let repo: SupabaseFestivalRepository;

  let testUserId: string;
  let pricedFestivalId: string;
  let unpricedFestivalId: string;
  let tentId: string;

  const BEER_CENTS = 1580;
  const SOFT_DRINK_CENTS = 632;
  const TENT_ONLY_BEER_CENTS = 1840;

  async function createFestival(name: string) {
    const { data, error } = await supabaseAdmin
      .from("festivals")
      .insert({
        name: `${name} ${Date.now()}`,
        short_name: `${name.slice(0, 4)}-${Date.now()}`,
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

    if (error || !data) {
      throw new Error(`Failed to create festival: ${error?.message}`);
    }
    return data.id;
  }

  beforeAll(async () => {
    supabaseAdmin = createTestSupabaseAdmin();
    const anon = createTestSupabaseAnon();

    const { data: authData, error: authError } = await anon.auth.signUp({
      email: `festival-prices-${Date.now()}@integration-test.com`,
      password: "test-password-123!",
    });

    if (authError || !authData.user || !authData.session) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }
    testUserId = authData.user.id;
    repo = new SupabaseFestivalRepository(createTestSupabaseWithAuth(authData.session.access_token));

    pricedFestivalId = await createFestival("Priced");
    unpricedFestivalId = await createFestival("Unpriced");

    await supabaseAdmin.from("drink_type_prices").insert([
      { festival_id: pricedFestivalId, drink_type: "beer", price_cents: BEER_CENTS },
      { festival_id: pricedFestivalId, drink_type: "soft_drink", price_cents: SOFT_DRINK_CENTS },
    ]);

    // A tent-scoped price, which must NOT leak into the festival's sheet: it is
    // a different rung of the cascade and the client should not predict it.
    const { data: tent, error: tentError } = await supabaseAdmin
      .from("tents")
      .insert({ id: randomUUID(), name: `Prices Tent ${Date.now()}`, category: "large" })
      .select()
      .single();

    if (tentError || !tent) {
      throw new Error(`Failed to create test tent: ${tentError?.message}`);
    }
    tentId = tent.id;

    const { data: festivalTent, error: ftError } = await supabaseAdmin
      .from("festival_tents")
      .insert({ festival_id: pricedFestivalId, tent_id: tentId })
      .select()
      .single();

    if (ftError || !festivalTent) {
      throw new Error(`Failed to link tent: ${ftError?.message}`);
    }

    await supabaseAdmin.from("drink_type_prices").insert({
      festival_tent_id: festivalTent.id,
      drink_type: "beer",
      price_cents: TENT_ONLY_BEER_CENTS,
    });
  });

  afterAll(async () => {
    for (const id of [pricedFestivalId, unpricedFestivalId]) {
      await supabaseAdmin.from("drink_type_prices").delete().eq("festival_id", id);
      await supabaseAdmin.from("festival_tents").delete().eq("festival_id", id);
      await supabaseAdmin.from("festivals").delete().eq("id", id);
    }
    await supabaseAdmin.from("tents").delete().eq("id", tentId);
    await supabaseAdmin.auth.admin.deleteUser(testUserId);
  });

  it("returns the festival's price sheet keyed by drink type", async () => {
    const festival = await repo.findById(pricedFestivalId);

    expect(festival?.drinkPrices).toEqual({
      beer: BEER_CENTS,
      soft_drink: SOFT_DRINK_CENTS,
    });
  });

  it("leaves the sheet empty for a festival that prices nothing", async () => {
    const festival = await repo.findById(unpricedFestivalId);

    expect(festival?.drinkPrices).toEqual({});
  });

  it("keeps tent-scoped prices out of the festival sheet", async () => {
    const festival = await repo.findById(pricedFestivalId);

    expect(festival?.drinkPrices.beer).toBe(BEER_CENTS);
    expect(festival?.drinkPrices.beer).not.toBe(TENT_ONLY_BEER_CENTS);
  });

  it("carries the sheet through list() as well as findById()", async () => {
    const festivals = await repo.list();
    const priced = festivals.find((f) => f.id === pricedFestivalId);

    expect(priced?.drinkPrices).toEqual({
      beer: BEER_CENTS,
      soft_drink: SOFT_DRINK_CENTS,
    });
  });
});
