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

describe("activity_feed day plans and reservations (Local DB)", () => {
  let admin: SupabaseClient<Database>;
  let owner: TestUser;
  let friend: TestUser;
  let groupMate: TestUser;
  let tent: TestTent;
  const festivals: TestFestival[] = [];

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    owner = await createTestUser("feed-owner");
    friend = await createTestUser("feed-friend");
    groupMate = await createTestUser("feed-groupmate");
    tent = await createTestTent(admin);
    // The friend never logs an attendance: plans must reach them anyway
    await makeFriends(admin, owner.id, friend.id);
  });

  afterAll(async () => {
    await cleanupDayPlanFixtures(admin, {
      festivalIds: festivals.map((festival) => festival.id),
      tentIds: [tent.id],
      userIds: [owner.id, friend.id, groupMate.id],
    });
  });

  // A festival per test, since plans collapse per user per festival
  async function newFestival(): Promise<TestFestival> {
    const festival = await createLiveFestival(admin);
    festivals.push(festival);
    return festival;
  }

  async function insertPlan(festivalId: string, overrides: Partial<DayPlanInsert>) {
    const { data, error } = await admin
      .from("day_plans")
      .insert({
        user_id: owner.id,
        festival_id: festivalId,
        date: dayFromToday(2),
        kind: "plan",
        ...overrides,
      })
      .select("id, feed_at")
      .single();

    expect(error).toBeNull();
    return data!;
  }

  function reservation(date: string): Partial<DayPlanInsert> {
    return {
      date,
      kind: "reservation",
      tent_id: tent.id,
      start_at: `${date}T16:00:00.000Z`,
      status: "pending",
      reminder_offset_minutes: 30,
      auto_checkin: false,
    };
  }

  async function feedSeenBy(user: TestUser, festivalId: string) {
    const { data, error } = await createTestSupabaseWithAuth(user.token)
      .from("activity_feed")
      .select("user_id, activity_type, activity_data, activity_time")
      .eq("festival_id", festivalId)
      .in("activity_type", ["day_plan", "tent_reservation"]);

    expect(error).toBeNull();
    return data ?? [];
  }

  it("collapses a friend's upcoming plans into one item, skipping past days", async () => {
    const festival = await newFestival();
    await insertPlan(festival.id, { date: dayFromToday(3) });
    await insertPlan(festival.id, { date: dayFromToday(1) });
    await insertPlan(festival.id, { date: dayFromToday(-1) });

    const feed = await feedSeenBy(friend, festival.id);

    expect(feed).toHaveLength(1);
    expect(feed[0].activity_type).toBe("day_plan");
    expect(feed[0].user_id).toBe(owner.id);
    expect(feed[0].activity_data).toEqual({
      dates: [dayFromToday(1), dayFromToday(3)],
      companions: [],
      includes_viewer: false,
    });
  });

  it("lists companions, dropping groups the viewer is not in and flagging the viewer", async () => {
    const festival = await newFestival();
    const username = `mate${Date.now()}`;
    await admin.from("profiles").update({ username }).eq("id", groupMate.id);
    const groupId = await createSharedGroup(admin, festival.id, [owner.id, groupMate.id]);
    const friendGroupId = await createSharedGroup(admin, festival.id, [owner.id, friend.id]);
    const { data: friendGroup } = await admin
      .from("groups")
      .select("name")
      .eq("id", friendGroupId)
      .single();
    const plan = await insertPlan(festival.id, {});

    const { error } = await admin.from("day_plan_companions").insert([
      { plan_id: plan.id, user_id: groupMate.id },
      { plan_id: plan.id, group_id: groupId },
      { plan_id: plan.id, group_id: friendGroupId },
      { plan_id: plan.id, user_id: friend.id },
    ]);
    expect(error).toBeNull();

    const [item] = await feedSeenBy(friend, festival.id);

    expect(item.activity_data).toMatchObject({
      companions: [friendGroup!.name, username].sort(),
      includes_viewer: true,
    });
  });

  it("never shows the owner their own plans", async () => {
    const festival = await newFestival();
    await insertPlan(festival.id, {});
    await insertPlan(festival.id, reservation(dayFromToday(4)));

    expect(await feedSeenBy(owner, festival.id)).toEqual([]);
  });

  it("hides a hidden plan, then surfaces it when made visible", async () => {
    const festival = await newFestival();
    const plan = await insertPlan(festival.id, { visible_to_groups: false });

    expect(await feedSeenBy(friend, festival.id)).toEqual([]);

    const { data: updated } = await admin
      .from("day_plans")
      .update({ visible_to_groups: true })
      .eq("id", plan.id)
      .select("feed_at")
      .single();

    expect(new Date(updated!.feed_at).getTime()).toBeGreaterThan(new Date(plan.feed_at).getTime());
    expect(await feedSeenBy(friend, festival.id)).toHaveLength(1);
  });

  it("shows a pending reservation with its tent and timezone, hiding cancelled and past ones", async () => {
    const festival = await newFestival();
    const pendingDate = dayFromToday(4);
    await insertPlan(festival.id, reservation(pendingDate));
    await insertPlan(festival.id, { ...reservation(dayFromToday(5)), status: "cancelled" });
    await insertPlan(festival.id, reservation(dayFromToday(-1)));

    const feed = await feedSeenBy(friend, festival.id);

    expect(feed).toHaveLength(1);
    expect(feed[0].activity_type).toBe("tent_reservation");
    expect(feed[0].activity_data).toMatchObject({
      tent_id: tent.id,
      tent_name: tent.name,
      date: pendingDate,
      timezone: "Europe/Berlin",
    });
  });

  it("re-announces a plan upgraded to a reservation", async () => {
    const festival = await newFestival();
    const date = dayFromToday(6);
    const plan = await insertPlan(festival.id, { date });

    const { data: updated, error } = await admin
      .from("day_plans")
      .update(reservation(date))
      .eq("id", plan.id)
      .select("feed_at")
      .single();

    expect(error).toBeNull();
    expect(new Date(updated!.feed_at).getTime()).toBeGreaterThan(new Date(plan.feed_at).getTime());

    const feed = await feedSeenBy(friend, festival.id);
    expect(feed.map((item) => item.activity_type)).toEqual(["tent_reservation"]);
  });

  it("keeps feed_at out of clients' hands", async () => {
    const festival = await newFestival();
    const backdated = "2020-01-01T00:00:00.000Z";
    const ownerClient = createTestSupabaseWithAuth(owner.token);

    const { data: inserted, error } = await ownerClient
      .from("day_plans")
      .insert({
        user_id: owner.id,
        festival_id: festival.id,
        date: dayFromToday(2),
        kind: "plan",
        feed_at: backdated,
      })
      .select("id, feed_at")
      .single();

    expect(error).toBeNull();
    expect(inserted!.feed_at).not.toBe(backdated);

    const { data: edited } = await ownerClient
      .from("day_plans")
      .update({ note: "bump?", feed_at: new Date().toISOString() })
      .eq("id", inserted!.id)
      .select("feed_at")
      .single();

    expect(edited!.feed_at).toBe(inserted!.feed_at);
  });
});
