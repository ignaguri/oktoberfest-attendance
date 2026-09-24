// Integration test: requires a running local Supabase with the group criteria migration applied.
// Run with: pnpm --filter=@prostcounter/api test:integration group-criteria
import { randomUUID } from "crypto";
import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
} from "../../../__tests__/helpers/test-supabase";

let admin: SupabaseClient<Database>;
let festivalId: string;
let groupId: string;
const users: Record<"ana" | "ben" | "cleo" | "dan", string> = {
  ana: "",
  ben: "",
  cleo: "",
  dan: "",
};

async function createUser(label: string): Promise<string> {
  const { data, error } = await createTestSupabaseAnon().auth.signUp({
    email: `criteria-${label}-${randomUUID()}@integration-test.com`,
    password: "test-password-123!",
  });
  if (error || !data.user) {
    throw new Error(`signUp failed: ${error?.message}`);
  }
  return data.user.id;
}

async function attend(userId: string, dates: string[], beersPerDay: number) {
  for (const date of dates) {
    const { data: attendance, error } = await admin
      .from("attendances")
      .insert({ user_id: userId, festival_id: festivalId, date })
      .select("id")
      .single();
    if (error || !attendance) {
      throw new Error(`attendance insert failed: ${error?.message}`);
    }
    const rows = Array.from({ length: beersPerDay }, () => ({
      attendance_id: attendance.id,
      drink_type: "beer" as const,
      base_price_cents: 1500,
      price_paid_cents: 1500,
      recorded_at: `${date}T12:00:00Z`,
    }));
    if (rows.length > 0) {
      const { error: drinkError } = await admin.from("consumptions").insert(rows);
      if (drinkError) {
        throw new Error(`consumption insert failed: ${drinkError.message}`);
      }
    }
  }
}

async function visitTents(userId: string, count: number) {
  const { data: tents, error } = await admin.from("tents").select("id").limit(count);
  if (error || !tents || tents.length < count) {
    throw new Error(`need ${count} tents in the local DB: ${error?.message}`);
  }
  const { error: visitError } = await admin.from("tent_visits").insert(
    tents.map((tent) => ({
      id: randomUUID(),
      user_id: userId,
      festival_id: festivalId,
      tent_id: tent.id,
    })),
  );
  if (visitError) {
    throw new Error(`tent visit insert failed: ${visitError.message}`);
  }
}

async function leaderboard(criteriaId: number) {
  const { data, error } = await admin.rpc("get_group_leaderboard", {
    p_group_id: groupId,
    p_winning_criteria_id: criteriaId,
  });
  if (error || !data) {
    throw new Error(`leaderboard failed: ${error?.message}`);
  }
  return data;
}

describe("group criteria: tents visited and longest streak", () => {
  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    const suffix = randomUUID();
    const { data: festival, error: festivalError } = await admin
      .from("festivals")
      .insert({
        name: `Criteria Test ${suffix}`,
        short_name: `criteria-${suffix}`.slice(0, 40),
        festival_type: "oktoberfest",
        start_date: "2026-09-19",
        end_date: "2026-10-04",
        beer_cost: 15.8,
        location: "Test Location",
        timezone: "Europe/Berlin",
        is_active: false,
        status: "ended",
      })
      .select("id")
      .single();
    if (festivalError || !festival) {
      throw new Error(`festival insert failed: ${festivalError?.message}`);
    }
    festivalId = festival.id;

    users.ana = await createUser("ana");
    users.ben = await createUser("ben");
    users.cleo = await createUser("cleo");
    users.dan = await createUser("dan");

    const { data: group, error: groupError } = await admin
      .from("groups")
      .insert({
        name: `Criteria ${suffix}`.slice(0, 50),
        password: "x",
        created_by: users.ana,
        winning_criteria_id: 4,
        festival_id: festivalId,
      })
      .select("id")
      .single();
    if (groupError || !group) {
      throw new Error(`group insert failed: ${groupError?.message}`);
    }
    groupId = group.id;
    const { error: memberError } = await admin.from("group_members").insert(
      Object.values(users).map((userId) => ({
        group_id: groupId,
        user_id: userId,
      })),
    );
    if (memberError) {
      throw new Error(`member insert failed: ${memberError.message}`);
    }

    // ana: 3-day run, gap, 2-day run → streak 3; 2 tents; 5 beers
    await attend(
      users.ana,
      ["2026-09-19", "2026-09-20", "2026-09-21", "2026-09-23", "2026-09-24"],
      1,
    );
    await visitTents(users.ana, 2);
    // ben: 2-day run → streak 2; 2 tents (ties ana); 6 beers → wins the tents tie-break
    await attend(users.ben, ["2026-09-19", "2026-09-20"], 3);
    await visitTents(users.ben, 2);
    // cleo: one day, no tent visits → tents 0, streak 1
    await attend(users.cleo, ["2026-09-22"], 1);
    // dan: no attendance, one tent visit → ahead of cleo on tents, last on streak
    await visitTents(users.dan, 1);
  });

  it("returns tents and streak per member, zero when missing", async () => {
    const rows = await leaderboard(4);
    const byUser = new Map(rows.map((row) => [row.user_id, row]));
    expect(byUser.get(users.ana)).toMatchObject({
      tents_visited: 2,
      longest_streak: 3,
    });
    expect(byUser.get(users.ben)).toMatchObject({
      tents_visited: 2,
      longest_streak: 2,
    });
    expect(byUser.get(users.cleo)).toMatchObject({
      tents_visited: 0,
      longest_streak: 1,
    });
  });

  it("orders by tents, breaking ties on total beers", async () => {
    const rows = await leaderboard(4);
    expect(rows.map((row) => row.user_id)).toEqual([users.ben, users.ana, users.dan, users.cleo]);
  });

  it("orders by longest streak", async () => {
    const rows = await leaderboard(5);
    expect(rows.map((row) => row.user_id)).toEqual([users.ana, users.ben, users.cleo, users.dan]);
  });

  it("ranks the final standings by the group's criterion", async () => {
    const { error } = await admin.rpc("refresh_festival_group_standings", {
      p_festival_id: festivalId,
    });
    expect(error).toBeNull();
    const { data } = await admin
      .from("festival_group_standings")
      .select("user_id, rank, criteria_id")
      .eq("group_id", groupId)
      .order("rank");
    expect(data?.map((row) => row.user_id)).toEqual([
      users.ben,
      users.ana,
      users.dan,
      users.cleo,
    ]);
    expect(data?.[0]?.criteria_id).toBe(4);
  });

  it("gives each member their real group position in Wrapped", async () => {
    const positions: Record<string, unknown> = {};
    for (const [label, userId] of Object.entries(users)) {
      const { data, error } = await admin.rpc("get_wrapped_data", {
        p_user_id: userId,
        p_festival_id: festivalId,
      });
      expect(error).toBeNull();
      const social = (data as { social_stats: { top_3_rankings: { position: number }[] } })
        .social_stats;
      positions[label] = social.top_3_rankings.map((ranking) => ranking.position);
    }
    expect(positions).toEqual({ ben: [1], ana: [2], dan: [3], cleo: [] });
  });

  it("only lists groups where the member is top 3 in Highlights, with the rank", async () => {
    const topGroups: Record<string, unknown> = {};
    for (const [label, userId] of Object.entries(users)) {
      const { data, error } = await admin.rpc("get_user_festival_stats_with_positions", {
        p_user_id: userId,
        p_festival_id: festivalId,
      });
      expect(error).toBeNull();
      const topPositions = (data?.[0]?.top_positions ?? []) as {
        position: number;
        total_members: number;
      }[];
      topGroups[label] = topPositions.map((top) => [top.position, top.total_members]);
    }
    expect(topGroups).toEqual({ ben: [[1, 4]], ana: [[2, 4]], dan: [[3, 4]], cleo: [] });
  });
});
