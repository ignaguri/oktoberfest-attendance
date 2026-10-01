import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDayPlanFixtures,
  createLiveFestival,
  createTestTent,
  createTestUser,
  type TestFestival,
  type TestTent,
  type TestUser,
} from "../../../__tests__/helpers/day-plan-fixtures";
import {
  createTestSupabaseAdmin,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";
import { SupabaseAdminRepository } from "../admin.repository";

/**
 * The two admin writes that used to be several requests: activating a festival
 * and setting a tent's beer price, now one RPC each.
 */
describe("admin writes are atomic (Local DB)", () => {
  let admin: SupabaseClient<Database>;
  let superAdmin: TestUser;
  let repo: SupabaseAdminRepository;
  let festival: TestFestival;
  let otherFestival: TestFestival;
  let tent: TestTent;
  // The shared local DB has a real active festival; put it back afterwards
  let previouslyActiveId: string | null;

  async function activeFestivalIds(): Promise<string[]> {
    const { data } = await admin.from("festivals").select("id").eq("is_active", true);
    return (data ?? []).map((row) => row.id);
  }

  async function tentPrices() {
    const { data: row } = await admin
      .from("festival_tents")
      .select("id, beer_price, beer_price_cents")
      .eq("festival_id", festival.id)
      .eq("tent_id", tent.id)
      .single();
    const { data: canonical } = await admin
      .from("drink_type_prices")
      .select("price_cents")
      .eq("festival_tent_id", row!.id)
      .eq("drink_type", "beer");
    return {
      beerPrice: row!.beer_price === null ? null : Number(row!.beer_price),
      beerPriceCents: row!.beer_price_cents,
      canonicalCents: canonical?.[0]?.price_cents ?? null,
    };
  }

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    superAdmin = await createTestUser("atomic-admin");
    await admin.from("profiles").update({ is_super_admin: true }).eq("id", superAdmin.id);
    repo = new SupabaseAdminRepository(createTestSupabaseWithAuth(superAdmin.token));

    festival = await createLiveFestival(admin);
    otherFestival = await createLiveFestival(admin);
    tent = await createTestTent(admin);
    await repo.addFestivalTent(festival.id, tent.id, 15.5);

    previouslyActiveId = (await activeFestivalIds())[0] ?? null;
  });

  afterAll(async () => {
    await admin.from("festivals").update({ is_active: false }).eq("is_active", true);
    if (previouslyActiveId) {
      await admin.from("festivals").update({ is_active: true }).eq("id", previouslyActiveId);
    }
    await admin.from("festival_tents").delete().in("festival_id", [festival.id, otherFestival.id]);
    await cleanupDayPlanFixtures(admin, {
      festivalIds: [festival.id, otherFestival.id],
      tentIds: [tent.id],
      userIds: [superAdmin.id],
    });
  });

  it("activating a festival leaves exactly that one active", async () => {
    await repo.updateFestival(festival.id, { is_active: true });
    await repo.updateFestival(otherFestival.id, { is_active: true });

    expect(await activeFestivalIds()).toEqual([otherFestival.id]);
  });

  it("a failed activation keeps the current active festival", async () => {
    const before = await activeFestivalIds();

    const { error } = await createTestSupabaseWithAuth(superAdmin.token).rpc(
      "set_active_festival",
      { p_festival_id: randomUUID() },
    );

    expect(error?.code).toBe("P0002");
    expect(await activeFestivalIds()).toEqual(before);
  });

  it("writes the price to all three places", async () => {
    await repo.updateFestivalTentPrice(festival.id, tent.id, 16.8);

    expect(await tentPrices()).toEqual({
      beerPrice: 16.8,
      beerPriceCents: 1680,
      canonicalCents: 1680,
    });
  });

  it("clears the canonical row along with the price", async () => {
    await repo.updateFestivalTentPrice(festival.id, tent.id, null);

    expect(await tentPrices()).toEqual({
      beerPrice: null,
      beerPriceCents: null,
      canonicalCents: null,
    });
  });
});
