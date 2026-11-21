import type { Database } from "@prostcounter/db";
import { formatDateForDatabase } from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDayPlanFixtures,
  createLiveFestival,
  createTestTent,
  createTestUser,
  DAY_PLAN_TEST_TIMEZONE,
  type TestFestival,
  type TestTent,
  type TestUser,
} from "../../../__tests__/helpers/day-plan-fixtures";
import {
  createTestSupabaseAdmin,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";
import { SupabaseAdminRepository } from "../admin.repository";

// Writing another user's consumptions depends on RLS, which only a real database exercises.
describe("admin drinks editor (Local DB)", () => {
  let admin: SupabaseClient<Database>;
  let superAdmin: TestUser;
  let owner: TestUser;
  let repo: SupabaseAdminRepository;
  let festival: TestFestival;
  let tent: TestTent;
  let attendanceId: string;

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    superAdmin = await createTestUser("drinks-admin");
    await admin.from("profiles").update({ is_super_admin: true }).eq("id", superAdmin.id);
    repo = new SupabaseAdminRepository(createTestSupabaseWithAuth(superAdmin.token));
    owner = await createTestUser("drinks-owner");

    festival = await createLiveFestival(admin);
    tent = await createTestTent(admin);
    await repo.addFestivalTent(festival.id, tent.id, 15.5);

    const { data, error } = await admin
      .from("attendances")
      .insert({ user_id: owner.id, festival_id: festival.id, date: festival.startDate })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(`Failed to create attendance: ${error?.message}`);
    }
    attendanceId = data.id;
  });

  afterAll(async () => {
    await admin.from("festival_tents").delete().eq("festival_id", festival.id);
    await cleanupDayPlanFixtures(admin, {
      festivalIds: [festival.id],
      tentIds: [tent.id],
      userIds: [superAdmin.id, owner.id],
    });
  });

  it("adds, retypes and removes another user's drink", async () => {
    const added = await repo.addAttendanceConsumption(attendanceId, {
      drink_type: "beer",
      tent_id: tent.id,
    });
    expect(added.basePriceCents).toBe(1550);
    expect(formatDateForDatabase(new Date(added.recordedAt), DAY_PLAN_TEST_TIMEZONE)).toBe(
      festival.startDate,
    );

    // A tip no tip mode produces, so a retype that re-applies the mode fails
    const tipCents = 230;
    await admin
      .from("consumptions")
      .update({ price_paid_cents: 1550 + tipCents })
      .eq("id", added.id);

    const retyped = await repo.updateConsumptionType(added.id, "soft_drink");
    const { data: softPrice } = await admin.rpc("get_drink_price_cents", {
      p_festival_id: festival.id,
      p_tent_id: tent.id,
      p_drink_type: "soft_drink",
    });
    expect(retyped.drinkType).toBe("soft_drink");
    expect(retyped.basePriceCents).toBe(softPrice);
    expect(retyped.pricePaidCents - retyped.basePriceCents).toBe(tipCents);

    expect(await repo.listAttendanceConsumptions(attendanceId)).toHaveLength(1);
    await repo.deleteConsumption(added.id);
    expect(await repo.listAttendanceConsumptions(attendanceId)).toEqual([]);
  });

  it("prices at the day's only tent, and removing the last drink zeroes the stored count", async () => {
    await admin.from("attendances").update({ beer_count: 3 }).eq("id", attendanceId);
    await admin.from("tent_visits").insert({
      id: crypto.randomUUID(),
      user_id: owner.id,
      festival_id: festival.id,
      tent_id: tent.id,
      visit_date: `${festival.startDate}T12:00:00Z`,
    });
    const { data: defaultPrice } = await admin.rpc("get_drink_price_cents", {
      p_festival_id: festival.id,
      p_drink_type: "beer",
    });
    expect(defaultPrice).not.toBe(1550);

    const added = await repo.addAttendanceConsumption(attendanceId, { drink_type: "beer" });
    expect(added.tentId).toBe(tent.id);
    expect(added.basePriceCents).toBe(1550);

    await repo.deleteConsumption(added.id);
    const { data: day } = await admin
      .from("attendances")
      .select("beer_count")
      .eq("id", attendanceId)
      .single();
    expect(day?.beer_count).toBe(0);

    await admin.from("tent_visits").delete().eq("user_id", owner.id);
  });

  it("an ordinary user cannot add or remove a drink on someone else's day", async () => {
    const ownerRepo = new SupabaseAdminRepository(createTestSupabaseWithAuth(owner.token));
    const other = await createTestUser("drinks-other");
    const { data } = await admin
      .from("attendances")
      .insert({ user_id: other.id, festival_id: festival.id, date: festival.startDate })
      .select("id")
      .single();

    await expect(
      ownerRepo.addAttendanceConsumption(data!.id, { drink_type: "beer" }),
    ).rejects.toThrow();
    expect(await repo.listAttendanceConsumptions(data!.id)).toEqual([]);

    // The add stops at the attendance read; a delete reaches the consumptions policy
    const seeded = await repo.addAttendanceConsumption(data!.id, { drink_type: "beer" });
    await expect(ownerRepo.deleteConsumption(seeded.id)).rejects.toThrow("Consumption not found");
    expect(await repo.listAttendanceConsumptions(data!.id)).toHaveLength(1);

    await cleanupDayPlanFixtures(admin, { festivalIds: [], tentIds: [], userIds: [other.id] });
  });
});
