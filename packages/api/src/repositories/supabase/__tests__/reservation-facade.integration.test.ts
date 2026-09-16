import type { Database } from "@prostcounter/db";
import { ErrorCodes } from "@prostcounter/shared/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDayPlanFixtures,
  createLiveFestival,
  createTestTent,
  createTestUser,
  dayFromToday,
  type TestFestival,
  type TestTent,
  type TestUser,
} from "../../../__tests__/helpers/day-plan-fixtures";
import {
  createTestSupabaseAdmin,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";
import { SupabaseDayPlanRepository } from "../day-plan.repository";
import { SupabaseReservationRepository } from "../reservation.repository";

/** 10:00 UTC is 11:00 or 12:00 in Munich, so always the same calendar day. */
function startAtOn(date: string): string {
  return `${date}T10:00:00.000Z`;
}

describe("SupabaseReservationRepository on day_plans (Local DB)", () => {
  let admin: SupabaseClient<Database>;
  let owner: TestUser;
  let festival: TestFestival;
  let tent: TestTent;
  let reservations: SupabaseReservationRepository;
  let dayPlans: SupabaseDayPlanRepository;

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    owner = await createTestUser("facade-owner");
    festival = await createLiveFestival(admin);
    tent = await createTestTent(admin);
    const client = createTestSupabaseWithAuth(owner.token);
    reservations = new SupabaseReservationRepository(client);
    dayPlans = new SupabaseDayPlanRepository(client);
  });

  afterAll(async () => {
    await cleanupDayPlanFixtures(admin, {
      festivalIds: [festival.id],
      tentIds: [tent.id],
      userIds: [owner.id],
    });
  });

  function createInput(date: string, note?: string) {
    return {
      festivalId: festival.id,
      tentId: tent.id,
      startAt: startAtOn(date),
      note,
      visibleToGroups: true,
      autoCheckin: false,
      reminderOffsetMinutes: 30,
    };
  }

  it("files a new reservation under its festival-local day", async () => {
    const date = dayFromToday(1);

    const reservation = await reservations.create(owner.id, createInput(date));

    expect(reservation).toMatchObject({ tentId: tent.id, status: "pending", tentName: tent.name });
    expect(await dayPlans.findActiveByDate(owner.id, festival.id, date)).toMatchObject({
      id: reservation.id,
      kind: "reservation",
    });
  });

  it("turns an existing plan into the reservation and keeps the plan's note", async () => {
    const date = dayFromToday(2);
    const plan = await dayPlans.insert(owner.id, festival.id, date, {
      kind: "plan",
      tentId: null,
      note: "with the office crew",
      visibleToGroups: true,
      startAt: null,
      endAt: null,
      status: null,
      reminderOffsetMinutes: null,
      autoCheckin: null,
    });

    const reservation = await reservations.create(owner.id, createInput(date));

    expect(reservation).toMatchObject({
      id: plan.id,
      note: "with the office crew",
      status: "pending",
    });
  });

  it("refuses a second reservation on the same day", async () => {
    const date = dayFromToday(3);
    await reservations.create(owner.id, createInput(date));

    await expect(reservations.create(owner.id, createInput(date))).rejects.toMatchObject({
      code: ErrorCodes.DAY_PLAN_CONFLICT,
    });
  });

  it("lists reservations but not plans", async () => {
    const planDate = dayFromToday(4);
    const plan = await dayPlans.insert(owner.id, festival.id, planDate, {
      kind: "plan",
      tentId: null,
      note: null,
      visibleToGroups: true,
      startAt: null,
      endAt: null,
      status: null,
      reminderOffsetMinutes: null,
      autoCheckin: null,
    });

    const { data } = await reservations.list(owner.id, festival.id);

    expect(data.length).toBeGreaterThan(0);
    expect(data.map((reservation) => reservation.id)).not.toContain(plan.id);
    expect(await reservations.findById(plan.id, owner.id)).toBeNull();
  });

  it("moves the reservation's day when its start time moves", async () => {
    const date = dayFromToday(5);
    const newDate = dayFromToday(6);
    const reservation = await reservations.create(owner.id, createInput(date));

    await reservations.update(reservation.id, owner.id, { startAt: startAtOn(newDate) });

    expect(await dayPlans.findActiveByDate(owner.id, festival.id, date)).toBeNull();
    expect(await dayPlans.findActiveByDate(owner.id, festival.id, newDate)).toMatchObject({
      id: reservation.id,
    });
  });
});
