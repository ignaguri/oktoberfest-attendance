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
  DAY_PLAN_TEST_TIMEZONE,
  makeFriends,
  type TestFestival,
  type TestTent,
  type TestUser,
} from "../../../__tests__/helpers/day-plan-fixtures";
import {
  createTestSupabaseAdmin,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";
import type { DayPlanWrite } from "../../interfaces";
import { SupabaseDayPlanRepository } from "../day-plan.repository";

describe("SupabaseDayPlanRepository (Local DB)", () => {
  let admin: SupabaseClient<Database>;
  let owner: TestUser;
  let friend: TestUser;
  let stranger: TestUser;
  let festival: TestFestival;
  let friendsFestival: TestFestival;
  let tent: TestTent;
  let ownerRepo: SupabaseDayPlanRepository;
  let friendRepo: SupabaseDayPlanRepository;
  let strangerRepo: SupabaseDayPlanRepository;

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    owner = await createTestUser("dpr-owner");
    friend = await createTestUser("dpr-friend");
    stranger = await createTestUser("dpr-stranger");
    festival = await createLiveFestival(admin);
    friendsFestival = await createLiveFestival(admin);
    tent = await createTestTent(admin);
    await makeFriends(admin, owner.id, friend.id);
    ownerRepo = new SupabaseDayPlanRepository(createTestSupabaseWithAuth(owner.token));
    friendRepo = new SupabaseDayPlanRepository(createTestSupabaseWithAuth(friend.token));
    strangerRepo = new SupabaseDayPlanRepository(createTestSupabaseWithAuth(stranger.token));
  });

  afterAll(async () => {
    await cleanupDayPlanFixtures(admin, {
      festivalIds: [festival.id, friendsFestival.id],
      tentIds: [tent.id],
      userIds: [owner.id, friend.id, stranger.id],
    });
  });

  function planWrite(overrides: Partial<DayPlanWrite> = {}): DayPlanWrite {
    return {
      kind: "plan",
      tentId: null,
      note: null,
      visibleToGroups: true,
      startAt: null,
      endAt: null,
      status: null,
      reminderOffsetMinutes: null,
      autoCheckin: null,
      ...overrides,
    };
  }

  function reservationWrite(date: string, overrides: Partial<DayPlanWrite> = {}): DayPlanWrite {
    return {
      kind: "reservation",
      tentId: tent.id,
      note: null,
      visibleToGroups: true,
      startAt: `${date}T10:00:00.000Z`,
      endAt: null,
      status: "pending",
      reminderOffsetMinutes: 30,
      autoCheckin: false,
      ...overrides,
    };
  }

  it("reads the festival's day context", async () => {
    expect(await ownerRepo.getFestivalContext(festival.id)).toEqual({
      id: festival.id,
      timezone: DAY_PLAN_TEST_TIMEZONE,
      startDate: festival.startDate,
      endDate: festival.endDate,
    });
  });

  it("creates a plan and finds it by date with its tent name", async () => {
    const date = dayFromToday(1);
    const created = await ownerRepo.insert(
      owner.id,
      festival.id,
      date,
      planWrite({ tentId: tent.id, note: "with the crew" }),
    );

    const found = await ownerRepo.findActiveByDate(owner.id, festival.id, date);

    expect(found).toMatchObject({
      id: created.id,
      kind: "plan",
      date,
      tentId: tent.id,
      tentName: tent.name,
      note: "with the crew",
    });
  });

  it("upgrades a plan to a reservation in place", async () => {
    const date = dayFromToday(2);
    const plan = await ownerRepo.insert(owner.id, festival.id, date, planWrite());

    const reservation = await ownerRepo.update(plan.id, owner.id, reservationWrite(date));

    expect(reservation).toMatchObject({
      id: plan.id,
      kind: "reservation",
      status: "pending",
      reminderOffsetMinutes: 30,
    });
  });

  it("clears reservation state when downgrading to a plan", async () => {
    const date = dayFromToday(3);
    const reservation = await ownerRepo.insert(owner.id, festival.id, date, reservationWrite(date));
    await admin
      .from("day_plans")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", reservation.id);

    const plan = await ownerRepo.update(reservation.id, owner.id, planWrite());

    expect(plan).toMatchObject({
      kind: "plan",
      startAt: null,
      status: null,
      reminderOffsetMinutes: null,
      reminderSentAt: null,
    });
  });

  it("refuses a second active row for the same day", async () => {
    const date = dayFromToday(4);
    await ownerRepo.insert(owner.id, festival.id, date, planWrite());

    await expect(ownerRepo.insert(owner.id, festival.id, date, planWrite())).rejects.toMatchObject({
      code: ErrorCodes.DAY_PLAN_CONFLICT,
    });
  });

  it("stops counting a cancelled reservation as the day's mark", async () => {
    const date = dayFromToday(5);
    const reservation = await ownerRepo.insert(owner.id, festival.id, date, reservationWrite(date));

    const cancelled = await ownerRepo.cancel(reservation.id, owner.id);

    expect(cancelled.status).toBe("cancelled");
    expect(await ownerRepo.findActiveByDate(owner.id, festival.id, date)).toBeNull();
    expect((await ownerRepo.listActive(owner.id, festival.id)).map((p) => p.id)).not.toContain(
      reservation.id,
    );
    await expect(ownerRepo.insert(owner.id, festival.id, date, planWrite())).resolves.toMatchObject(
      {
        kind: "plan",
      },
    );
  });

  it("deletes a plan", async () => {
    const date = dayFromToday(6);
    const plan = await ownerRepo.insert(owner.id, festival.id, date, planWrite());

    await ownerRepo.deleteById(plan.id, owner.id);

    expect(await ownerRepo.findActiveByDate(owner.id, festival.id, date)).toBeNull();
  });

  describe("listFriendsGoing", () => {
    const today = dayFromToday(0);
    const visibleDate = dayFromToday(6);
    const hiddenDate = dayFromToday(7);
    const pastDate = dayFromToday(-1);

    beforeAll(async () => {
      await ownerRepo.insert(
        owner.id,
        friendsFestival.id,
        visibleDate,
        planWrite({ note: "with the crew" }),
      );
      await ownerRepo.insert(
        owner.id,
        friendsFestival.id,
        hiddenDate,
        planWrite({ visibleToGroups: false }),
      );
      await admin
        .from("day_plans")
        .insert({
          user_id: owner.id,
          festival_id: friendsFestival.id,
          date: pastDate,
          kind: "plan",
        });
      await friendRepo.insert(friend.id, friendsFestival.id, visibleDate, planWrite());
    });

    it("shows a friend only visible days from today on", async () => {
      const days = await friendRepo.listFriendsGoing(friend.id, friendsFestival.id, today);

      expect(days.map((day) => day.date)).toEqual([visibleDate]);
      expect(days[0].users).toEqual([
        expect.objectContaining({ userId: owner.id, kind: "plan", note: "with the crew" }),
      ]);
    });

    it("never lists the caller", async () => {
      const days = await ownerRepo.listFriendsGoing(owner.id, friendsFestival.id, today);
      const userIds = days.flatMap((day) => day.users.map((user) => user.userId));

      expect(userIds).toContain(friend.id);
      expect(userIds).not.toContain(owner.id);
    });

    it("shows a stranger nothing", async () => {
      expect(await strangerRepo.listFriendsGoing(stranger.id, friendsFestival.id, today)).toEqual(
        [],
      );
    });
  });
});
