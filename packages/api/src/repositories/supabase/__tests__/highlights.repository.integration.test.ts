import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDayPlanFixtures,
  createLiveFestival,
  createTestUser,
  dayFromToday,
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
import { SupabaseProfileRepository } from "../profile.repository";

describe("getHighlights (Local DB)", () => {
  let admin: SupabaseClient<Database>;
  let drinker: TestUser;
  let absentee: TestUser;
  let festival: TestFestival;

  function repoFor(user: TestUser) {
    return new SupabaseProfileRepository(createTestSupabaseWithAuth(user.token));
  }

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    drinker = await createTestUser("hl-drinker");
    absentee = await createTestUser("hl-absentee");
    festival = await createLiveFestival(admin);

    const firstDay = await insertAttendance(admin, drinker.id, festival.id, dayFromToday(-2));
    await insertConsumption(admin, firstDay, "beer");
    await insertConsumption(admin, firstDay, "beer");
    const secondDay = await insertAttendance(admin, drinker.id, festival.id, dayFromToday(-1));
    await insertConsumption(admin, secondDay, "beer");
  });

  afterAll(async () => {
    await cleanupAttendanceFixtures(admin, [festival.id]);
    await cleanupDayPlanFixtures(admin, {
      festivalIds: [festival.id],
      tentIds: [],
      userIds: [drinker.id, absentee.id],
    });
  });

  it("derives the average from total beers and days attended", async () => {
    const highlights = await repoFor(drinker).getHighlights(drinker.id, festival.id);

    expect(highlights.totalBeers).toBe(3);
    expect(highlights.totalDays).toBe(2);
    expect(highlights.avgBeersPerDay).toBe(1.5);
  });

  it("returns 0 for a user with no days", async () => {
    const highlights = await repoFor(absentee).getHighlights(absentee.id, festival.id);

    expect(highlights.avgBeersPerDay).toBe(0);
  });
});
