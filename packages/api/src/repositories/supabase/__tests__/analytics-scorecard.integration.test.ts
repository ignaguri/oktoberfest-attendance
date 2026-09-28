// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test:integration -- analytics-scorecard
//
// Seeds its own users, festivals and activity in 1960, 1961 and 2997, so the
// festival-filtered scorecard only ever sees this file's rows on a shared local
// DB. Signup cohorts are keyed on real sign-up dates (this month), so they are
// asserted as a delta against a baseline taken before the users exist.
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";

const admin = createTestSupabaseAdmin();
const createdUserIds: string[] = [];
const createdFestivalIds: string[] = [];

interface SeedUser {
  id: string;
  token: string;
}

function tag(): string {
  return randomUUID().slice(0, 8);
}

async function signUp(email: string): Promise<SeedUser> {
  const { data, error } = await createTestSupabaseAnon().auth.signUp({
    email,
    password: "test-password-123!",
  });
  if (error || !data.user || !data.session) {
    throw new Error(`Failed to create ${email}: ${error?.message ?? "no session"}`);
  }
  createdUserIds.push(data.user.id);
  return { id: data.user.id, token: data.session.access_token };
}

async function createFestival(startDate: string, endDate: string): Promise<string> {
  const suffix = randomUUID().slice(0, 12);
  const { data, error } = await admin
    .from("festivals")
    .insert({
      name: `Scorecard Test Festival ${suffix}`,
      short_name: `sc-${suffix}`,
      festival_type: "oktoberfest",
      start_date: startDate,
      end_date: endDate,
      beer_cost: 16.2,
      location: "Test Location",
      timezone: "Europe/Berlin",
      is_active: false,
      status: "ended",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create festival: ${error?.message ?? "no data"}`);
  }
  createdFestivalIds.push(data.id);
  return data.id;
}

type ScorecardRow = {
  feature: string;
  attendees: number;
  adopters: number;
  came_back_users: number;
  came_back_users_base: number;
  came_back_non_users: number;
  came_back_non_users_base: number;
  returned_users: number;
  returned_users_base: number;
  returned_non_users: number;
  returned_non_users_base: number;
};

async function scorecardFor(festivalId: string): Promise<Record<string, ScorecardRow>> {
  const { data, error } = await admin.rpc("analytics_feature_scorecard", {
    p_festival_id: festivalId,
  });
  if (error || !data) {
    throw new Error(`analytics_feature_scorecard failed: ${error?.message ?? "no data"}`);
  }
  return Object.fromEntries(data.map((row) => [row.feature, row as ScorecardRow]));
}

type CohortCounts = {
  signups: number;
  activated: number;
  activated_7d: number;
  engaged: number;
  returned: number;
};

/** This month in Europe/Berlin as YYYY-MM-01, matching the function's bucket. */
function currentBerlinMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  return `${parts}-01`;
}

async function cohortForThisMonth(): Promise<CohortCounts> {
  const { data, error } = await admin.rpc("analytics_signup_cohorts");
  if (error || !data) {
    throw new Error(`analytics_signup_cohorts failed: ${error?.message ?? "no data"}`);
  }
  const row = data.find((candidate) => candidate.month === currentBerlinMonth());
  return {
    signups: row?.signups ?? 0,
    activated: row?.activated ?? 0,
    activated_7d: row?.activated_7d ?? 0,
    engaged: row?.engaged ?? 0,
    returned: row?.returned ?? 0,
  };
}

let baselineCohort: CohortCounts;
let userOne: SeedUser;
let festivalS: string;
let futureFestival: string;
let groupId: string | undefined;

describe("analytics scorecard and cohort functions", () => {
  beforeAll(async () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Integration tests need local Supabase env vars; see the file header");
    }

    baselineCohort = await cohortForThisMonth();

    userOne = await signUp(`scorecard-1-${tag()}@integration-test.com`);
    const userTwo = await signUp(`scorecard-2-${tag()}@integration-test.com`);
    const userThree = await signUp(`scorecard-3-${tag()}@integration-test.com`);
    const userFour = await signUp(`scorecard-4-${tag()}@integration-test.com`);
    const seedAccount = await signUp(`scorecard-seed-${tag()}@example.com`);

    festivalS = await createFestival("1960-01-10", "1960-01-14");
    const festivalT = await createFestival("1961-01-10", "1961-01-12");
    futureFestival = await createFestival("2997-01-01", "2997-01-03");

    const { data: attendanceRows, error: attendanceError } = await admin
      .from("attendances")
      .insert(
        [
          { user_id: userOne.id, festival_id: festivalS, date: "1960-01-10" },
          { user_id: userOne.id, festival_id: festivalS, date: "1960-01-12" },
          { user_id: userOne.id, festival_id: festivalS, date: "1960-01-14" },
          { user_id: userOne.id, festival_id: festivalT, date: "1961-01-10" },
          { user_id: userOne.id, festival_id: futureFestival, date: "2997-01-01" },
          { user_id: userTwo.id, festival_id: festivalS, date: "1960-01-11" },
          { user_id: userTwo.id, festival_id: festivalS, date: "1960-01-12" },
          { user_id: userThree.id, festival_id: festivalS, date: "1960-01-10" },
          { user_id: userFour.id, festival_id: festivalS, date: "1960-01-13" },
          { user_id: seedAccount.id, festival_id: festivalS, date: "1960-01-10" },
        ].map((row) => ({ ...row, beer_count: 1 })),
      )
      .select("id, user_id, date");
    if (attendanceError || !attendanceRows) {
      throw new Error(`Failed to seed attendances: ${attendanceError?.message ?? "no data"}`);
    }
    const attendanceId = (userId: string, date: string) => {
      const match = attendanceRows.find((row) => row.user_id === userId && row.date === date);
      if (!match) {
        throw new Error(`No seeded attendance for ${userId} on ${date}`);
      }
      return match.id;
    };

    // Drinks: userOne on their first day, userTwo only on their last day, and
    // the seed account (excluded from every count).
    const { error: drinkError } = await admin.from("consumptions").insert(
      [
        attendanceId(userOne.id, "1960-01-10"),
        attendanceId(userTwo.id, "1960-01-12"),
        attendanceId(seedAccount.id, "1960-01-10"),
      ].map((id) => ({
        attendance_id: id,
        base_price_cents: 1600,
        price_paid_cents: 1600,
        drink_type: "beer",
        volume_ml: 1000,
      })),
    );
    if (drinkError) {
      throw new Error(`Failed to seed consumptions: ${drinkError.message}`);
    }

    // A group at festival S that userOne joined five days before it started.
    const { data: criteria, error: criteriaError } = await admin
      .from("winning_criteria")
      .select("id")
      .limit(1)
      .single();
    if (criteriaError || !criteria) {
      throw new Error(`No winning criteria: ${criteriaError?.message ?? "no data"}`);
    }
    const { data: group, error: groupError } = await admin
      .from("groups")
      .insert({
        name: `Scorecard Group ${tag()}`,
        password: "scorecard",
        winning_criteria_id: criteria.id,
        festival_id: festivalS,
      })
      .select("id")
      .single();
    if (groupError || !group) {
      throw new Error(`Failed to seed group: ${groupError?.message ?? "no data"}`);
    }
    groupId = group.id;
    const { error: memberError } = await admin.from("group_members").insert({
      group_id: group.id,
      user_id: userOne.id,
      joined_at: "1960-01-05T10:00:00Z",
    });
    if (memberError) {
      throw new Error(`Failed to seed group member: ${memberError.message}`);
    }

    // Friend requests carry no festival: userThree's falls inside S's dates,
    // userFour's a week after S ends.
    const { error: friendError } = await admin.from("friendships").insert([
      { requester_id: userThree.id, addressee_id: userFour.id, created_at: "1960-01-11T12:00:00Z" },
      { requester_id: userFour.id, addressee_id: userOne.id, created_at: "1960-01-20T12:00:00Z" },
    ]);
    if (friendError) {
      throw new Error(`Failed to seed friendships: ${friendError.message}`);
    }
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await admin.from("friendships").delete().in("requester_id", createdUserIds);
    }
    if (groupId !== undefined) {
      await admin.from("group_members").delete().eq("group_id", groupId);
      await admin.from("groups").delete().eq("id", groupId);
    }
    if (createdFestivalIds.length > 0) {
      await admin.from("attendances").delete().in("festival_id", createdFestivalIds);
      await admin.from("festivals").delete().in("id", createdFestivalIds);
    }
    for (const userId of createdUserIds) {
      await admin.from("profiles").delete().eq("id", userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        console.warn(`Failed to delete test user ${userId}: ${error.message}`);
      }
    }
  });

  it("returns every scorecard feature, with the real attendees of the festival", async () => {
    const rows = await scorecardFor(festivalS);

    expect(Object.keys(rows).sort()).toEqual(
      [
        "crowd_reports",
        "day_plans",
        "drinks",
        "friend_requests",
        "group_joins",
        "group_messages",
        "location_sharing",
        "photo_comments",
        "photo_reactions",
        "photos",
        "wrapped",
      ].sort(),
    );
    for (const row of Object.values(rows)) {
      // Four real users; the @example.com seed account is excluded
      expect(row.attendees).toBe(4);
    }
  });

  it("does not count the day of first use as coming back", async () => {
    const { drinks } = await scorecardFor(festivalS);

    // userOne drank on day one and came back; userTwo drank on their last day
    expect(drinks).toMatchObject({
      adopters: 2,
      came_back_users: 1,
      came_back_users_base: 2,
      came_back_non_users: 0,
      came_back_non_users_base: 2,
    });
  });

  it("counts a group joined before the festival from the first attendance day", async () => {
    const { group_joins: groupJoins } = await scorecardFor(festivalS);

    // Non-users: userTwo came back, userThree and userFour did not
    expect(groupJoins).toMatchObject({
      adopters: 1,
      came_back_users: 1,
      came_back_users_base: 1,
      came_back_non_users: 1,
      came_back_non_users_base: 3,
    });
  });

  it("matches friend requests to a festival by its local dates only", async () => {
    const { friend_requests: friendRequests } = await scorecardFor(festivalS);

    // userThree requested during S (single day, so no coming back); userFour's
    // request a week later does not count
    expect(friendRequests).toMatchObject({
      adopters: 1,
      came_back_users: 0,
      came_back_users_base: 1,
      came_back_non_users: 2,
      came_back_non_users_base: 3,
    });
  });

  it("counts a later festival for festivals whose successor has started", async () => {
    const { drinks } = await scorecardFor(festivalS);

    expect(drinks).toMatchObject({
      returned_users: 1,
      returned_users_base: 2,
      returned_non_users: 0,
      returned_non_users_base: 2,
    });
  });

  it("leaves the later-festival column empty when no successor has started", async () => {
    const rows = await scorecardFor(futureFestival);

    for (const row of Object.values(rows)) {
      expect(row).toMatchObject({
        attendees: 1,
        returned_users_base: 0,
        returned_non_users_base: 0,
      });
    }
  });

  it("counts this month's real sign-ups through the cohort steps", async () => {
    const after = await cohortForThisMonth();

    expect({
      signups: after.signups - baselineCohort.signups,
      activated: after.activated - baselineCohort.activated,
      activated_7d: after.activated_7d - baselineCohort.activated_7d,
      engaged: after.engaged - baselineCohort.engaged,
      returned: after.returned - baselineCohort.returned,
    }).toEqual({ signups: 4, activated: 4, activated_7d: 4, engaged: 1, returned: 1 });
  });

  it("orders cohorts newest month first", async () => {
    const { data } = await admin.rpc("analytics_signup_cohorts");
    const months = (data ?? []).map((row) => row.month);
    expect(months).toEqual([...months].sort().reverse());
  });

  it("denies both functions to signed-in users and anon", async () => {
    const userClient = createTestSupabaseWithAuth(userOne.token);
    const anonClient = createTestSupabaseAnon();

    const results = await Promise.all([
      userClient.rpc("analytics_feature_scorecard", {}),
      userClient.rpc("analytics_signup_cohorts"),
      anonClient.rpc("analytics_feature_scorecard", {}),
      anonClient.rpc("analytics_signup_cohorts"),
    ]);

    for (const result of results) {
      expect(result.error?.code).toBe("42501");
    }
  });
});
