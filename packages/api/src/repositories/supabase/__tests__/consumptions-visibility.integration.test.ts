import type { Database } from "@prostcounter/db";
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
  cleanupAttendanceFixtures,
  insertAttendance,
  insertConsumption,
} from "../../../__tests__/helpers/friends-went-fixtures";
import {
  createTestSupabaseAdmin,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";

describe("consumptions visibility (Local DB)", () => {
  let admin: SupabaseClient<Database>;
  let owner: TestUser;
  let friend: TestUser;
  let groupMate: TestUser;
  let otherFestivalMate: TestUser;
  let stranger: TestUser;
  let festival: TestFestival;
  let otherFestival: TestFestival;
  let consumptionId: string;

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    owner = await createTestUser("cv-owner");
    friend = await createTestUser("cv-friend");
    groupMate = await createTestUser("cv-mate");
    otherFestivalMate = await createTestUser("cv-other-mate");
    stranger = await createTestUser("cv-stranger");
    festival = await createLiveFestival(admin);
    otherFestival = await createLiveFestival(admin);
    await makeFriends(admin, owner.id, friend.id);
    await createSharedGroup(admin, festival.id, [owner.id, groupMate.id]);
    await createSharedGroup(admin, otherFestival.id, [owner.id, otherFestivalMate.id]);

    const attendanceId = await insertAttendance(admin, owner.id, festival.id, dayFromToday(-1));
    consumptionId = await insertConsumption(admin, attendanceId, "beer");
  });

  afterAll(async () => {
    await cleanupAttendanceFixtures(admin, [festival.id, otherFestival.id]);
    await cleanupDayPlanFixtures(admin, {
      festivalIds: [festival.id, otherFestival.id],
      tentIds: [],
      userIds: [owner.id, friend.id, groupMate.id, otherFestivalMate.id, stranger.id],
    });
  });

  async function readAs(user: TestUser) {
    return createTestSupabaseWithAuth(user.token)
      .from("consumptions")
      .select("id")
      .eq("id", consumptionId);
  }

  it("lets a friend with no shared group read it", async () => {
    const { data, error } = await readAs(friend);

    expect(error).toBeNull();
    expect(data).toEqual([{ id: consumptionId }]);
  });

  it("lets a group-mate in that festival read it", async () => {
    const { data, error } = await readAs(groupMate);

    expect(error).toBeNull();
    expect(data).toEqual([{ id: consumptionId }]);
  });

  it("still lets the owner read it", async () => {
    const { data } = await readAs(owner);

    expect(data).toEqual([{ id: consumptionId }]);
  });

  it("hides it from a group-mate of another festival", async () => {
    const { data } = await readAs(otherFestivalMate);

    expect(data).toEqual([]);
  });

  it("hides it from a stranger", async () => {
    const { data } = await readAs(stranger);

    expect(data).toEqual([]);
  });
});
