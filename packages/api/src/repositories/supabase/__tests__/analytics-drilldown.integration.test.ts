// Integration test: requires a running local Supabase.
// Run with: cd packages/api && npx vitest run --config vitest.integration.config.ts analytics-drilldown
//
// Parity: for every drill target, the members function filtered by the shared
// table has exactly as many rows as the aggregate reports. Parity holds for
// any data, so the pooled and cohort checks run against whatever the local DB
// holds; the per-festival checks use festivals seeded in 1970 and 1971.
import {
  ANALYTICS_COHORT_STEPS,
  ANALYTICS_FUNNEL_STEPS,
  ANALYTICS_SCORECARD_FEATURES,
  ANALYTICS_SCORECARD_SEGMENTS,
  COHORT_STEP_FILTERS,
  FUNNEL_STEP_MIN_DAYS,
  SCORECARD_SEGMENT_FILTERS,
} from "@prostcounter/shared";
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
      name: `Drilldown Test Festival ${suffix}`,
      short_name: `dd-${suffix}`,
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

/** Today in UTC as YYYY-MM-DD, matching the funnel's signed_up_at::date. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** This month in Europe/Berlin as YYYY-MM-01, matching the cohort bucket. */
function currentBerlinMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  return `${parts}-01`;
}

async function scorecardMemberCount(
  festivalId: string | undefined,
  feature: string,
  segment: (typeof ANALYTICS_SCORECARD_SEGMENTS)[number],
): Promise<number> {
  let query = admin
    .rpc("analytics_scorecard_members", festivalId ? { p_festival_id: festivalId } : {})
    .eq("feature", feature);
  for (const [column, value] of Object.entries(SCORECARD_SEGMENT_FILTERS[segment])) {
    query = query.eq(column, value);
  }
  const { data, error } = await query.range(0, 9999);
  if (error || !data) {
    throw new Error(`analytics_scorecard_members failed: ${error?.message ?? "no data"}`);
  }
  return data.length;
}

type ScorecardRow = Record<string, number | string>;

async function scorecard(festivalId?: string): Promise<Record<string, ScorecardRow>> {
  const { data, error } = await admin.rpc(
    "analytics_feature_scorecard",
    festivalId ? { p_festival_id: festivalId } : {},
  );
  if (error || !data) {
    throw new Error(`analytics_feature_scorecard failed: ${error?.message ?? "no data"}`);
  }
  return Object.fromEntries(data.map((row) => [row.feature, row as ScorecardRow]));
}

/** The aggregate column each segment must equal, straight from the SQL row. */
function expectedSegmentCount(
  row: ScorecardRow,
  segment: (typeof ANALYTICS_SCORECARD_SEGMENTS)[number],
): number {
  const value = (column: string) => row[column] as number;
  switch (segment) {
    case "attendees":
      return value("attendees");
    case "adopters":
      return value("adopters");
    case "non_adopters":
      return value("came_back_non_users_base");
    case "came_back_adopters":
      return value("came_back_users");
    case "came_back_non_adopters":
      return value("came_back_non_users");
    case "returned_adopters":
      return value("returned_users");
    case "returned_non_adopters":
      return value("returned_non_users");
  }
}

type TimelineRow = {
  occurred_at: string;
  kind: string;
  name: string;
  props: Record<string, unknown>;
  festival_name: string | null;
  cursor_key: string;
};

async function timeline(args: Record<string, unknown>): Promise<TimelineRow[]> {
  const { data, error } = await admin.rpc("analytics_user_timeline", args as { p_user_id: string });
  if (error || !data) {
    throw new Error(`analytics_user_timeline failed: ${error?.message ?? "no data"}`);
  }
  return data as TimelineRow[];
}

let userOne: SeedUser;
let timelineUser: SeedUser;
let festivalA: string;
let festivalB: string;

describe("analytics drill-down functions", () => {
  beforeAll(async () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Integration tests need local Supabase env vars; see the file header");
    }

    userOne = await signUp(`drilldown-1-${tag()}@integration-test.com`);
    const userTwo = await signUp(`drilldown-2-${tag()}@integration-test.com`);
    timelineUser = await signUp(`drilldown-t-${tag()}@integration-test.com`);

    festivalA = await createFestival("1970-01-10", "1970-01-14");
    festivalB = await createFestival("1971-01-10", "1971-01-12");

    // userOne at both festivals (two pooled rows per feature), 5 days in total;
    // userTwo at A only, one day.
    const { data: attendanceRows, error: attendanceError } = await admin
      .from("attendances")
      .insert(
        [
          { user_id: userOne.id, festival_id: festivalA, date: "1970-01-10" },
          { user_id: userOne.id, festival_id: festivalA, date: "1970-01-11" },
          { user_id: userOne.id, festival_id: festivalA, date: "1970-01-12" },
          { user_id: userOne.id, festival_id: festivalA, date: "1970-01-13" },
          { user_id: userOne.id, festival_id: festivalB, date: "1971-01-10" },
          { user_id: userTwo.id, festival_id: festivalA, date: "1970-01-12" },
        ].map((row) => ({ ...row, beer_count: 1 })),
      )
      .select("id, user_id, date");
    if (attendanceError || !attendanceRows) {
      throw new Error(`Failed to seed attendances: ${attendanceError?.message ?? "no data"}`);
    }
    const firstDayOne = attendanceRows.find(
      (row) => row.user_id === userOne.id && row.date === "1970-01-10",
    );
    if (!firstDayOne) {
      throw new Error("No seeded first-day attendance for userOne");
    }
    const { error: drinkError } = await admin.from("consumptions").insert({
      attendance_id: firstDayOne.id,
      base_price_cents: 1600,
      price_paid_cents: 1600,
      drink_type: "beer",
      volume_ml: 1000,
    });
    if (drinkError) {
      throw new Error(`Failed to seed consumptions: ${drinkError.message}`);
    }

    // Two app-open days for userOne; member lists sort by the later one.
    const { error: activeDaysError } = await admin.from("user_active_days").insert([
      { user_id: userOne.id, day: "2001-01-01", platform: "ios" },
      { user_id: userOne.id, day: "2001-01-05", platform: "ios" },
    ]);
    if (activeDaysError) {
      throw new Error(`Failed to seed active days: ${activeDaysError.message}`);
    }

    // Timeline user: an attendance at 09:00, a group message at 10:30 whose
    // body must never surface, and events at 10:00 and twice at 11:00 (a tie).
    const { error: timelineAttendanceError } = await admin.from("attendances").insert({
      user_id: timelineUser.id,
      festival_id: festivalA,
      date: "1970-01-10",
      beer_count: 1,
      created_at: "2000-01-01T09:00:00Z",
    });
    if (timelineAttendanceError) {
      throw new Error(`Failed to seed timeline attendance: ${timelineAttendanceError.message}`);
    }
    const { error: messageError } = await admin.from("group_messages").insert({
      festival_id: festivalA,
      user_id: timelineUser.id,
      content: "drilldown-secret-body",
      created_at: "2000-01-01T10:30:00Z",
    });
    if (messageError) {
      throw new Error(`Failed to seed group message: ${messageError.message}`);
    }
    const sessionId = randomUUID();
    const { error: eventError } = await admin.rpc("analytics_record_events", {
      p_user_id: timelineUser.id,
      p_events: [
        {
          name: "app_opened",
          props: { source: "cold" },
          occurred_at: "2000-01-01T10:00:00Z",
          session_id: sessionId,
        },
        {
          name: "screen_viewed",
          props: { screen: "/home" },
          occurred_at: "2000-01-01T11:00:00Z",
          session_id: sessionId,
        },
        {
          name: "screen_viewed",
          props: { screen: "/groups" },
          occurred_at: "2000-01-01T11:00:00Z",
          session_id: sessionId,
        },
      ],
      p_platform: "ios",
      p_app_version: "9.9.9",
    });
    if (eventError) {
      throw new Error(`Failed to seed events: ${eventError.message}`);
    }
  });

  afterAll(async () => {
    if (createdFestivalIds.length > 0) {
      await admin.from("group_messages").delete().in("festival_id", createdFestivalIds);
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

  it("lists as many people as each scorecard number, for one festival", async () => {
    const rows = await scorecard(festivalA);
    for (const feature of ANALYTICS_SCORECARD_FEATURES) {
      for (const segment of ANALYTICS_SCORECARD_SEGMENTS) {
        expect({
          feature,
          segment,
          count: await scorecardMemberCount(festivalA, feature, segment),
        }).toEqual({ feature, segment, count: expectedSegmentCount(rows[feature], segment) });
      }
    }
  });

  it("lists as many people as each pooled drinks number", async () => {
    const rows = await scorecard();
    for (const segment of ANALYTICS_SCORECARD_SEGMENTS) {
      expect({ segment, count: await scorecardMemberCount(undefined, "drinks", segment) }).toEqual({
        segment,
        count: expectedSegmentCount(rows.drinks, segment),
      });
    }
  });

  it("lists a person once per festival in the pooled view", async () => {
    const { data, error } = await admin
      .rpc("analytics_scorecard_members", {})
      .eq("feature", "drinks")
      .eq("user_id", userOne.id);
    expect(error).toBeNull();
    expect((data ?? []).map((row) => row.festival_id).sort()).toEqual(
      [festivalA, festivalB].sort(),
    );
    expect(
      (data ?? []).every((row) => row.festival_name?.startsWith("Drilldown Test Festival")),
    ).toBe(true);
  });

  it("lists as many people as each funnel step", async () => {
    const today = todayUtc();
    const { data: steps, error } = await admin.rpc("analytics_activation_funnel", {
      p_from: today,
      p_to: today,
    });
    expect(error).toBeNull();
    for (const step of ANALYTICS_FUNNEL_STEPS) {
      const { data: members, error: membersError } = await admin
        .rpc("analytics_funnel_members", { p_from: today, p_to: today })
        .gte("attendance_days", FUNNEL_STEP_MIN_DAYS[step])
        .range(0, 9999);
      expect(membersError).toBeNull();
      const expected = (steps ?? []).find((row) => row.step === step)?.users;
      expect({ step, count: members?.length }).toEqual({ step, count: expected });
    }
  });

  it("counts attendance days per funnel member", async () => {
    const today = todayUtc();
    const { data } = await admin
      .rpc("analytics_funnel_members", { p_from: today, p_to: today })
      .eq("user_id", userOne.id);
    expect(data).toEqual([
      { user_id: userOne.id, attendance_days: 5, last_active_day: "2001-01-05" },
    ]);
  });

  // The API caps member lists and orders by this column before the cap, so a
  // capped list keeps the most recently active people.
  it("gives every member list each person's last active day", async () => {
    const today = todayUtc();
    const funnel = await admin
      .rpc("analytics_funnel_members", { p_from: today, p_to: today })
      .eq("user_id", userOne.id);
    const scorecardRows = await admin
      .rpc("analytics_scorecard_members", {})
      .eq("feature", "drinks")
      .eq("user_id", userOne.id);
    const cohort = await admin
      .rpc("analytics_cohort_members")
      .eq("month", currentBerlinMonth())
      .eq("user_id", userOne.id);
    for (const { data, error } of [funnel, scorecardRows, cohort]) {
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThan(0);
      expect((data ?? []).map((row) => row.last_active_day)).toEqual(
        (data ?? []).map(() => "2001-01-05"),
      );
    }
  });

  it("lists as many people as each cohort step this month", async () => {
    const month = currentBerlinMonth();
    const { data: cohorts } = await admin.rpc("analytics_signup_cohorts");
    const row = (cohorts ?? []).find((candidate) => candidate.month === month);
    const expected: Record<string, number | undefined> = {
      signups: row?.signups,
      activated: row?.activated,
      activated_7d: row?.activated_7d,
      engaged: row?.engaged,
      returned: row?.returned,
    };
    for (const step of ANALYTICS_COHORT_STEPS) {
      let query = admin.rpc("analytics_cohort_members").eq("month", month);
      for (const [column, value] of Object.entries(COHORT_STEP_FILTERS[step])) {
        query = query.eq(column, value);
      }
      const { data: members, error } = await query.range(0, 9999);
      expect(error).toBeNull();
      expect({ step, count: members?.length }).toEqual({ step, count: expected[step] });
    }
  });

  it("returns display fields for member ids", async () => {
    const { data, error } = await admin.rpc("analytics_member_profiles", {
      p_user_ids: [userOne.id],
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({ user_id: userOne.id });
    expect(typeof data?.[0]?.signed_up_at).toBe("string");
  });

  it("interleaves events and actions, newest first", async () => {
    const rows = await timeline({ p_user_id: timelineUser.id });
    expect(rows.map((row) => row.name)).toEqual([
      "signed_up",
      "screen_viewed",
      "screen_viewed",
      "group_message",
      "app_opened",
      "attendance",
    ]);
    expect(rows.find((row) => row.name === "attendance")?.festival_name).toMatch(
      /^Drilldown Test Festival/,
    );
  });

  it("pages through tied timestamps without skipping or repeating", async () => {
    const all = await timeline({ p_user_id: timelineUser.id });
    const seen: string[] = [];
    let cursor: { at: string; key: string } | null = null;
    for (let page = 0; page < all.length + 1; page++) {
      const rows = await timeline({
        p_user_id: timelineUser.id,
        p_limit: 1,
        ...(cursor ? { p_cursor_at: cursor.at, p_cursor_key: cursor.key } : {}),
      });
      if (rows.length === 0) {
        break;
      }
      seen.push(rows[0].cursor_key);
      cursor = { at: rows[0].occurred_at, key: rows[0].cursor_key };
    }
    expect(seen).toEqual(all.map((row) => row.cursor_key));
  });

  it("returns full pages of one kind", async () => {
    const events = await timeline({ p_user_id: timelineUser.id, p_kind: "event", p_limit: 2 });
    expect(events.map((row) => row.kind)).toEqual(["event", "event"]);
    const actions = await timeline({ p_user_id: timelineUser.id, p_kind: "action" });
    expect(actions.map((row) => row.name)).toEqual(["signed_up", "group_message", "attendance"]);
  });

  it("never returns message or comment bodies", async () => {
    const rows = await timeline({ p_user_id: timelineUser.id });
    expect(JSON.stringify(rows)).not.toContain("drilldown-secret-body");
  });

  it("clamps the limit to at least one row", async () => {
    expect(await timeline({ p_user_id: timelineUser.id, p_limit: 0 })).toHaveLength(1);
    expect(await timeline({ p_user_id: timelineUser.id, p_limit: -5 })).toHaveLength(1);
  });

  it("returns nothing for an unknown user", async () => {
    expect(await timeline({ p_user_id: randomUUID() })).toEqual([]);
  });

  it("denies every new function to signed-in users and anon", async () => {
    const clients = [createTestSupabaseWithAuth(userOne.token), createTestSupabaseAnon()];
    for (const client of clients) {
      const results = await Promise.all([
        client.rpc("analytics_funnel_members", { p_from: todayUtc(), p_to: todayUtc() }),
        client.rpc("analytics_scorecard_members", {}),
        client.rpc("analytics_cohort_members"),
        client.rpc("analytics_member_profiles", { p_user_ids: [userOne.id] }),
        client.rpc("analytics_user_timeline", { p_user_id: userOne.id }),
      ]);
      for (const result of results) {
        expect(result.error?.code).toBe("42501");
      }
    }
  });
});
