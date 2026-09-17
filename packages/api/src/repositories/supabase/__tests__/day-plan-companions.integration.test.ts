import type { Database } from "@prostcounter/db";
import { ErrorCodes } from "@prostcounter/shared/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDayPlanFixtures,
  createLiveFestival,
  createSharedGroup,
  createTestUser,
  dayFromToday,
  makeFriends,
  type TestFestival,
  type TestUser,
} from "../../../__tests__/helpers/day-plan-fixtures";
import {
  createTestSupabaseAdmin,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";
import type { DayPlanWrite } from "../../interfaces";
import { SupabaseDayPlanRepository } from "../day-plan.repository";

const PLAN_WRITE: DayPlanWrite = {
  kind: "plan",
  tentId: null,
  note: null,
  visibleToGroups: true,
  startAt: null,
  endAt: null,
  status: null,
  reminderOffsetMinutes: null,
  autoCheckin: null,
};

const FRIEND_USERNAME = `dpc_friend_${Date.now()}`;

describe("Day plan companions (Local DB)", () => {
  let admin: SupabaseClient<Database>;
  let owner: TestUser;
  let friend: TestUser;
  let groupMate: TestUser;
  let stranger: TestUser;
  let festival: TestFestival;
  let otherFestival: TestFestival;
  let sharedGroupId: string;
  let otherFestivalGroupId: string;
  let strangerGroupId: string;
  let ownerRepo: SupabaseDayPlanRepository;
  let friendRepo: SupabaseDayPlanRepository;
  let strangerClient: SupabaseClient<Database>;

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    owner = await createTestUser("dpc-owner");
    friend = await createTestUser("dpc-friend");
    groupMate = await createTestUser("dpc-mate");
    stranger = await createTestUser("dpc-stranger");
    festival = await createLiveFestival(admin);
    otherFestival = await createLiveFestival(admin);
    await makeFriends(admin, owner.id, friend.id);
    await admin.from("profiles").update({ username: FRIEND_USERNAME }).eq("id", friend.id);
    sharedGroupId = await createSharedGroup(admin, festival.id, [owner.id, groupMate.id]);
    otherFestivalGroupId = await createSharedGroup(admin, otherFestival.id, [owner.id]);
    strangerGroupId = await createSharedGroup(admin, festival.id, [stranger.id]);
    ownerRepo = new SupabaseDayPlanRepository(createTestSupabaseWithAuth(owner.token));
    friendRepo = new SupabaseDayPlanRepository(createTestSupabaseWithAuth(friend.token));
    strangerClient = createTestSupabaseWithAuth(stranger.token);
  });

  afterAll(async () => {
    await cleanupDayPlanFixtures(admin, {
      festivalIds: [festival.id, otherFestival.id],
      tentIds: [],
      userIds: [owner.id, friend.id, groupMate.id, stranger.id],
    });
  });

  it("offers friends, group-mates and the user's groups in the festival", async () => {
    const options = await ownerRepo.listCompanionOptions(owner.id, festival.id);

    expect(options.users.map((user) => user.userId).sort()).toEqual(
      [friend.id, groupMate.id].sort(),
    );
    expect(options.groups.map((group) => group.groupId)).toEqual([sharedGroupId]);
  });

  it("tags a friend, a group-mate and a group, and reads them back with names", async () => {
    const date = dayFromToday(1);
    const plan = await ownerRepo.insert(owner.id, festival.id, date, PLAN_WRITE);

    await ownerRepo.setCompanions(plan.id, [friend.id, groupMate.id], [sharedGroupId]);
    const found = await ownerRepo.findActiveByDate(owner.id, festival.id, date);

    expect(found?.companions.users.map((user) => user.userId).sort()).toEqual(
      [friend.id, groupMate.id].sort(),
    );
    expect(found?.companions.users.find((user) => user.userId === friend.id)?.username).toBe(
      FRIEND_USERNAME,
    );
    expect(found?.companions.groups).toEqual([
      { groupId: sharedGroupId, name: expect.any(String) },
    ]);
  });

  it("rejects a stranger and keeps the tags it had", async () => {
    const date = dayFromToday(2);
    const plan = await ownerRepo.insert(owner.id, festival.id, date, PLAN_WRITE);
    await ownerRepo.setCompanions(plan.id, [friend.id], []);

    await expect(ownerRepo.setCompanions(plan.id, [stranger.id], [])).rejects.toMatchObject({
      code: ErrorCodes.DAY_PLAN_INVALID_COMPANION,
    });

    const found = await ownerRepo.findActiveByDate(owner.id, festival.id, date);
    expect(found?.companions.users.map((user) => user.userId)).toEqual([friend.id]);
  });

  it("rejects a group from another festival or one the user isn't in", async () => {
    const date = dayFromToday(3);
    const plan = await ownerRepo.insert(owner.id, festival.id, date, PLAN_WRITE);

    await expect(
      ownerRepo.setCompanions(plan.id, [], [otherFestivalGroupId]),
    ).rejects.toMatchObject({ code: ErrorCodes.DAY_PLAN_INVALID_COMPANION });
    await expect(ownerRepo.setCompanions(plan.id, [], [strangerGroupId])).rejects.toMatchObject({
      code: ErrorCodes.DAY_PLAN_INVALID_COMPANION,
    });
  });

  it("refuses to let anyone but the owner change a plan's tags", async () => {
    const date = dayFromToday(4);
    const plan = await ownerRepo.insert(owner.id, festival.id, date, PLAN_WRITE);
    await ownerRepo.setCompanions(plan.id, [groupMate.id], []);

    await expect(friendRepo.setCompanions(plan.id, [friend.id], [])).rejects.toMatchObject({
      code: ErrorCodes.DAY_PLAN_INVALID_COMPANION,
    });

    const found = await ownerRepo.findActiveByDate(owner.id, festival.id, date);
    expect(found?.companions.users.map((user) => user.userId)).toEqual([groupMate.id]);
  });

  it("shows the tags to friends who can see the plan, and not to strangers", async () => {
    const date = dayFromToday(5);
    const plan = await ownerRepo.insert(owner.id, festival.id, date, PLAN_WRITE);
    await ownerRepo.setCompanions(plan.id, [groupMate.id], [sharedGroupId]);

    const days = await friendRepo.listFriendsGoing(friend.id, festival.id, date);
    const ownerEntry = days
      .find((day) => day.date === date)
      ?.users.find((user) => user.userId === owner.id);

    expect(ownerEntry?.companions.users.map((user) => user.userId)).toEqual([groupMate.id]);

    const { data: strangerRows } = await strangerClient
      .from("day_plan_companions")
      .select("id")
      .eq("plan_id", plan.id);
    expect(strangerRows).toEqual([]);
  });

  it("deletes the tags with their plan", async () => {
    const date = dayFromToday(6);
    const plan = await ownerRepo.insert(owner.id, festival.id, date, PLAN_WRITE);
    await ownerRepo.setCompanions(plan.id, [friend.id], []);

    await ownerRepo.deleteById(plan.id, owner.id);

    const { count } = await admin
      .from("day_plan_companions")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", plan.id);
    expect(count).toBe(0);
  });
});
