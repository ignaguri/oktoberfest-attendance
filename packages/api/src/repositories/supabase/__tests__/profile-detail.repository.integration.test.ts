import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
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
  cleanupAttendanceFixtures,
  insertAttendance,
  insertConsumption,
  insertTentVisit,
} from "../../../__tests__/helpers/friends-went-fixtures";
import {
  createTestSupabaseAdmin,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";
import { NotFoundError } from "../../../middleware/error";
import { SupabaseProfileRepository } from "../profile.repository";

/**
 * The gate on this endpoint is RLS, not application code. These tests exist to
 * prove that: a stranger must read an empty history through the database, not
 * through a branch someone can later delete by accident.
 */
describe("getProfileDetail (Local DB)", () => {
  let admin: SupabaseClient<Database>;
  let owner: TestUser;
  let friend: TestUser;
  let groupMate: TestUser;
  let stranger: TestUser;
  let festival: TestFestival;
  let otherFestival: TestFestival;
  let tent: TestTent;
  let sharedGroupId: string;
  let otherFestivalGroupId: string;

  function repoFor(user: TestUser) {
    return new SupabaseProfileRepository(createTestSupabaseWithAuth(user.token));
  }

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    owner = await createTestUser("pd-owner");
    friend = await createTestUser("pd-friend");
    groupMate = await createTestUser("pd-mate");
    stranger = await createTestUser("pd-stranger");
    festival = await createLiveFestival(admin);
    otherFestival = await createLiveFestival(admin);
    tent = await createTestTent(admin);

    await makeFriends(admin, owner.id, friend.id);
    sharedGroupId = await createSharedGroup(admin, festival.id, [owner.id, groupMate.id]);
    // Carrying a group over to a new festival keeps its name, so the same two
    // people routinely share same-named groups in several festivals.
    otherFestivalGroupId = await createSharedGroup(admin, otherFestival.id, [
      owner.id,
      groupMate.id,
    ]);

    const attendanceId = await insertAttendance(admin, owner.id, festival.id, dayFromToday(-1));
    await insertConsumption(admin, attendanceId, "beer");
    await insertConsumption(admin, attendanceId, "beer");
    await insertTentVisit(admin, {
      userId: owner.id,
      festivalId: festival.id,
      tentId: tent.id,
      visitDate: `${dayFromToday(-1)}T18:00:00.000Z`,
    });
  });

  afterAll(async () => {
    await cleanupAttendanceFixtures(admin, [festival.id, otherFestival.id]);
    await cleanupDayPlanFixtures(admin, {
      festivalIds: [festival.id, otherFestival.id],
      tentIds: [tent.id],
      userIds: [owner.id, friend.id, groupMate.id, stranger.id],
    });
  });

  it("gives a stranger identity but no history and no favourite tent", async () => {
    const profile = await repoFor(stranger).getProfileDetail(owner.id, festival.id, stranger.id);

    expect(profile.id).toBe(owner.id);
    expect(profile.history).toEqual([]);
    expect(profile.favouriteTent).toBeNull();
    expect(profile.sharedGroups).toEqual([]);
    expect(profile.friendshipStatus).toBe("none");
    expect(profile.friendsSince).toBeNull();
  });

  // The global leaderboard already shows everyone's festival totals, so a
  // stranger gets them too. They used to read the right days next to zero
  // drinks, because RLS emptied the consumptions under the stats view.
  it("gives a stranger the real festival stats", async () => {
    const profile = await repoFor(stranger).getProfileDetail(owner.id, festival.id, stranger.id);

    expect(profile.stats).toEqual({ daysAttended: 1, totalBeers: 2, avgBeers: 2 });
  });

  it("gives a stranger the real stats in the public profile", async () => {
    const profile = await repoFor(stranger).getPublicProfile(owner.id, festival.id, stranger.id);

    expect(profile.stats).toEqual({ daysAttended: 1, totalBeers: 2, avgBeers: 2 });
  });

  it("gives a friend the history and the favourite tent", async () => {
    const profile = await repoFor(friend).getProfileDetail(owner.id, festival.id, friend.id);

    expect(profile.history).toHaveLength(1);
    expect(profile.history[0]).toMatchObject({
      festivalId: festival.id,
      daysAttended: 1,
      totalBeers: 2,
    });
    expect(profile.favouriteTent).toEqual({ name: tent.name, visits: 1 });
    expect(profile.friendshipStatus).toBe("friends");
    expect(profile.friendsSince).not.toBeNull();
  });

  it("gives a group mate the history and the shared group's name", async () => {
    const profile = await repoFor(groupMate).getProfileDetail(owner.id, festival.id, groupMate.id);

    expect(profile.history).toHaveLength(1);
    expect(profile.sharedGroups).toHaveLength(1);
    expect(profile.sharedGroups[0].id).toBe(sharedGroupId);
    expect(profile.sharedGroups[0].name).toBeTruthy();
    expect(profile.friendshipStatus).toBe("none");
  });

  it("scopes shared groups to the requested festival", async () => {
    const repo = repoFor(groupMate);

    const thisFestival = await repo.getProfileDetail(owner.id, festival.id, groupMate.id);
    const other = await repo.getProfileDetail(owner.id, otherFestival.id, groupMate.id);

    expect(thisFestival.sharedGroups.map((group) => group.id)).toEqual([sharedGroupId]);
    expect(other.sharedGroups.map((group) => group.id)).toEqual([otherFestivalGroupId]);
  });

  it("returns no shared groups when no festival is requested", async () => {
    const profile = await repoFor(groupMate).getProfileDetail(owner.id, undefined, groupMate.id);

    expect(profile.sharedGroups).toEqual([]);
  });

  // The route used to wrap this call in a catch-all that reported every
  // failure as a 404, so the error type is the contract now.
  it("throws NotFoundError for a user that does not exist", async () => {
    const missingUserId = randomUUID();

    await expect(
      repoFor(friend).getProfileDetail(missingUserId, festival.id, friend.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("marks the owner's own profile as self", async () => {
    const profile = await repoFor(owner).getProfileDetail(owner.id, festival.id, owner.id);

    expect(profile.friendshipStatus).toBe("self");
    expect(profile.history).toHaveLength(1);
  });

  describe("listProfileDays", () => {
    it("gives a friend the day's drinks and tents", async () => {
      const days = await repoFor(friend).listProfileDays(owner.id, festival.id);

      expect(days).toHaveLength(1);
      expect(days[0]).toEqual({
        date: dayFromToday(-1),
        totalDrinks: 2,
        tents: [tent.name],
      });
    });

    it("gives a stranger nothing", async () => {
      const days = await repoFor(stranger).listProfileDays(owner.id, festival.id);

      expect(days).toEqual([]);
    });
  });
});
