import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDayPlanFixtures,
  createLiveFestival,
  createSharedGroup,
  createTestTent,
  createTestUser,
  dayFromToday,
  makeFriends,
  type TestFestival,
  type TestTent,
  type TestUser,
} from "../../../__tests__/helpers/day-plan-fixtures";
import {
  createTestSupabaseAdmin,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";

type DayPlanInsert = Database["public"]["Tables"]["day_plans"]["Insert"];

describe("day_plans schema (Local DB)", () => {
  let admin: SupabaseClient<Database>;
  let owner: TestUser;
  let friend: TestUser;
  let groupMate: TestUser;
  let otherFestivalMate: TestUser;
  let festival: TestFestival;
  let otherFestival: TestFestival;
  let tent: TestTent;

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    owner = await createTestUser("dp-owner");
    friend = await createTestUser("dp-friend");
    groupMate = await createTestUser("dp-groupmate");
    otherFestivalMate = await createTestUser("dp-other");
    festival = await createLiveFestival(admin);
    otherFestival = await createLiveFestival(admin);
    tent = await createTestTent(admin);
    await makeFriends(admin, owner.id, friend.id);
    await createSharedGroup(admin, festival.id, [owner.id, groupMate.id]);
    await createSharedGroup(admin, otherFestival.id, [owner.id, otherFestivalMate.id]);
  });

  afterAll(async () => {
    await cleanupDayPlanFixtures(admin, {
      festivalIds: [festival.id, otherFestival.id],
      tentIds: [tent.id],
      userIds: [owner.id, friend.id, groupMate.id, otherFestivalMate.id],
    });
  });

  function insertRow(overrides: Partial<DayPlanInsert>) {
    return admin
      .from("day_plans")
      .insert({
        user_id: owner.id,
        festival_id: festival.id,
        date: dayFromToday(2),
        kind: "plan",
        ...overrides,
      })
      .select("id")
      .single();
  }

  it("rejects a reservation without a tent or start time", async () => {
    const { error } = await insertRow({
      date: dayFromToday(1),
      kind: "reservation",
      status: "pending",
      reminder_offset_minutes: 30,
      auto_checkin: false,
    });

    expect(error?.code).toBe("23514");
  });

  it("rejects a plan carrying reservation state", async () => {
    const { error } = await insertRow({ date: dayFromToday(1), status: "pending" });

    expect(error?.code).toBe("23514");
  });

  it("allows one active row per user per day, and a cancelled row does not count", async () => {
    const date = dayFromToday(3);

    const cancelled = await insertRow({
      date,
      kind: "reservation",
      tent_id: tent.id,
      start_at: `${date}T10:00:00.000Z`,
      status: "cancelled",
      reminder_offset_minutes: 30,
      auto_checkin: false,
    });
    expect(cancelled.error).toBeNull();

    const active = await insertRow({ date });
    expect(active.error).toBeNull();

    const duplicate = await insertRow({ date });
    expect(duplicate.error?.code).toBe("23505");
  });

  describe("visibility", () => {
    const visibleDate = dayFromToday(4);
    const hiddenDate = dayFromToday(5);

    beforeAll(async () => {
      await insertRow({ date: visibleDate, visible_to_groups: true, note: "with the crew" });
      await insertRow({ date: hiddenDate, visible_to_groups: false });
    });

    async function datesSeenBy(user: TestUser): Promise<string[]> {
      const { data, error } = await createTestSupabaseWithAuth(user.token)
        .from("day_plans")
        .select("date")
        .eq("user_id", owner.id)
        .eq("festival_id", festival.id)
        .in("date", [visibleDate, hiddenDate]);

      expect(error).toBeNull();
      return (data ?? []).map((row) => row.date).sort();
    }

    it("shows the owner both rows", async () => {
      expect(await datesSeenBy(owner)).toEqual([visibleDate, hiddenDate].sort());
    });

    it("shows a friend only the visible row", async () => {
      expect(await datesSeenBy(friend)).toEqual([visibleDate]);
    });

    it("shows a group-mate in the same festival only the visible row", async () => {
      expect(await datesSeenBy(groupMate)).toEqual([visibleDate]);
    });

    it("hides everything from a group-mate in another festival", async () => {
      expect(await datesSeenBy(otherFestivalMate)).toEqual([]);
    });
  });

  describe("reservation reminder RPC", () => {
    it("returns due reservations and never plans", async () => {
      await admin
        .from("user_notification_preferences")
        .upsert({ user_id: owner.id, reminders_enabled: true }, { onConflict: "user_id" });

      const reservation = await insertRow({
        date: dayFromToday(6),
        kind: "reservation",
        tent_id: tent.id,
        start_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        status: "pending",
        reminder_offset_minutes: 30,
        auto_checkin: false,
      });
      const plan = await insertRow({ date: dayFromToday(7) });
      expect(reservation.error).toBeNull();
      expect(plan.error).toBeNull();

      const { data, error } = await admin.rpc("rpc_due_reservation_reminders", {
        p_now: new Date().toISOString(),
      });

      expect(error).toBeNull();
      const ids = (data ?? []).map((row) => row.id);
      expect(ids).toContain(reservation.data!.id);
      expect(ids).not.toContain(plan.data!.id);
    });

    it("cannot be called with a user token", async () => {
      const { error } = await createTestSupabaseWithAuth(owner.token).rpc(
        "rpc_due_reservation_reminders",
        { p_now: new Date().toISOString() },
      );

      expect(error?.code).toBe("42501");
    });
  });

  describe("overlap recipients", () => {
    it("returns friends and same-festival group-mates who marked the day, and nobody else", async () => {
      const date = dayFromToday(8);
      const { error: insertError } = await admin.from("day_plans").insert([
        { user_id: friend.id, festival_id: festival.id, date, kind: "plan" },
        { user_id: groupMate.id, festival_id: festival.id, date, kind: "plan" },
        { user_id: otherFestivalMate.id, festival_id: festival.id, date, kind: "plan" },
      ]);
      expect(insertError).toBeNull();

      const { data, error } = await admin.rpc("get_day_plan_overlap_recipients", {
        p_actor_id: owner.id,
        p_festival_id: festival.id,
        p_date: date,
      });

      expect(error).toBeNull();
      expect([...(data ?? [])].sort()).toEqual([friend.id, groupMate.id].sort());
    });

    it("cannot be called with a user token", async () => {
      const { error } = await createTestSupabaseWithAuth(owner.token).rpc(
        "get_day_plan_overlap_recipients",
        { p_actor_id: owner.id, p_festival_id: festival.id, p_date: dayFromToday(8) },
      );

      expect(error?.code).toBe("42501");
    });
  });
});
