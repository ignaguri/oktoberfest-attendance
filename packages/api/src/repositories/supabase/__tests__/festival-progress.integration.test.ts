// Integration test: requires a running local Supabase with the user festival progress migration applied.
// Run with: pnpm --filter=@prostcounter/api test:integration festival-progress
import { randomUUID } from "crypto";
import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deleteTestUsersAndFestivals } from "../../../__tests__/helpers/test-cleanup";
import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
} from "../../../__tests__/helpers/test-supabase";

let admin: SupabaseClient<Database>;
const suffix = randomUUID().slice(0, 8);
const festivalIds: Record<"series2024" | "series2025" | "current" | "other2025", string> = {
  series2024: "",
  series2025: "",
  current: "",
  other2025: "",
};
const users: Record<"sol" | "soc" | "pal", { id: string; client: SupabaseClient<Database> }> =
  {} as never;

async function createFestival(name: string, startDate: string, endDate: string): Promise<string> {
  const { data, error } = await admin
    .from("festivals")
    .insert({
      name,
      short_name: `prog-${randomUUID()}`.slice(0, 40),
      festival_type: "oktoberfest",
      start_date: startDate,
      end_date: endDate,
      beer_cost: 15.8,
      location: "Test Location",
      timezone: "Europe/Berlin",
      is_active: false,
      status: "ended",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`festival insert failed: ${error?.message}`);
  }
  return data.id;
}

async function createSignedInUser(label: string) {
  const client = createTestSupabaseAnon();
  const { data, error } = await client.auth.signUp({
    email: `progress-${label}-${randomUUID()}@integration-test.com`,
    password: "test-password-123!",
  });
  if (error || !data.user || !data.session) {
    throw new Error(`signUp failed or returned no session: ${error?.message}`);
  }
  return { id: data.user.id, client };
}

async function attend(userId: string, festivalId: string, dates: string[], beersPerDay: number) {
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

async function progress(client: SupabaseClient<Database>, today: string) {
  const { data, error } = await client.rpc("get_user_festival_progress", {
    p_festival_id: festivalIds.current,
    p_today: today,
  });
  if (error) {
    throw new Error(`rpc failed: ${error.message}`);
  }
  return data?.[0];
}

describe("get_user_festival_progress", () => {
  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    festivalIds.series2024 = await createFestival(
      `SoloProg ${suffix} 2024`,
      "2024-09-21",
      "2024-10-06",
    );
    festivalIds.series2025 = await createFestival(
      `SoloProg ${suffix} 2025`,
      "2025-09-20",
      "2025-10-05",
    );
    festivalIds.current = await createFestival(
      `SoloProg ${suffix} 2026`,
      "2026-09-19",
      "2026-10-04",
    );
    festivalIds.other2025 = await createFestival(
      `OtherProg ${suffix} 2025`,
      "2025-09-20",
      "2025-10-05",
    );

    users.sol = await createSignedInUser("sol");
    users.soc = await createSignedInUser("soc");
    users.pal = await createSignedInUser("pal");

    // sol, current festival: run of 3 (19-21), gap, run of 1 (23); 1 beer each
    await attend(
      users.sol.id,
      festivalIds.current,
      ["2026-09-19", "2026-09-20", "2026-09-21", "2026-09-23"],
      1,
    );
    // sol, planned future day: must not count toward any streak when today is 2026-09-24
    await attend(users.sol.id, festivalIds.current, ["2026-09-30"], 0);
    // sol attended 2024 (2 beers, 1 day), skipped 2025, attended another series in 2025
    await attend(users.sol.id, festivalIds.series2024, ["2024-09-22"], 2);
    await attend(users.sol.id, festivalIds.other2025, ["2025-09-21"], 5);

    // current festival has 3 tents; sol visits 2 of them
    const { data: tents, error: tentsError } = await admin.from("tents").select("id").limit(3);
    if (tentsError || !tents || tents.length < 3) {
      throw new Error(`need 3 tents in the local DB: ${tentsError?.message}`);
    }
    const { error: festivalTentsError } = await admin
      .from("festival_tents")
      .insert(tents.map((tent) => ({ festival_id: festivalIds.current, tent_id: tent.id })));
    if (festivalTentsError) {
      throw new Error(`festival_tents insert failed: ${festivalTentsError.message}`);
    }
    const { error: visitError } = await admin.from("tent_visits").insert([
      {
        id: randomUUID(),
        user_id: users.sol.id,
        festival_id: festivalIds.current,
        tent_id: tents[0].id,
      },
      {
        id: randomUUID(),
        user_id: users.sol.id,
        festival_id: festivalIds.current,
        tent_id: tents[0].id,
      },
      {
        id: randomUUID(),
        user_id: users.sol.id,
        festival_id: festivalIds.current,
        tent_id: tents[1].id,
      },
    ]);
    if (visitError) {
      throw new Error(`tent visit insert failed: ${visitError.message}`);
    }

    // soc: in a group at the current festival, accepted friend of pal
    // sol: in a group at 2024 only, and a pending request to pal
    for (const [festivalId, userId] of [
      [festivalIds.current, users.soc.id],
      [festivalIds.series2024, users.sol.id],
    ] as const) {
      const { data: group, error: groupError } = await admin
        .from("groups")
        .insert({
          name: `Prog ${suffix} ${userId.slice(0, 8)}`.slice(0, 50),
          password: "x",
          created_by: userId,
          winning_criteria_id: 1,
          festival_id: festivalId,
        })
        .select("id")
        .single();
      if (groupError || !group) {
        throw new Error(`group insert failed: ${groupError?.message}`);
      }
      const { error: memberError } = await admin
        .from("group_members")
        .insert({ group_id: group.id, user_id: userId });
      if (memberError) {
        throw new Error(`member insert failed: ${memberError.message}`);
      }
    }
    const { error: friendError } = await admin.from("friendships").insert([
      { requester_id: users.soc.id, addressee_id: users.pal.id, status: "accepted" },
      { requester_id: users.sol.id, addressee_id: users.pal.id, status: "pending" },
    ]);
    if (friendError) {
      throw new Error(`friendship insert failed: ${friendError.message}`);
    }
  });

  afterAll(async () => {
    await deleteTestUsersAndFestivals(admin, {
      userIds: Object.values(users)
        .map((user) => user.id)
        .filter(Boolean),
      festivalIds: Object.values(festivalIds).filter(Boolean),
    });
  });

  it("counts yesterday's run as the current streak and keeps the best one", async () => {
    const row = await progress(users.sol.client, "2026-09-24");
    expect(row?.current_streak).toBe(1);
    expect(row?.best_streak).toBe(3);
  });

  it("counts today and drops the streak after a missed day", async () => {
    expect((await progress(users.sol.client, "2026-09-23"))?.current_streak).toBe(1);
    expect((await progress(users.sol.client, "2026-09-21"))?.current_streak).toBe(3);
    const broken = await progress(users.sol.client, "2026-09-26");
    expect(broken?.current_streak).toBe(0);
    expect(broken?.best_streak).toBe(3);
  });

  it("scopes tents to the festival's own tent list", async () => {
    const row = await progress(users.sol.client, "2026-09-24");
    expect(row?.tents_visited).toBe(2);
    expect(row?.tents_total).toBe(3);
  });

  it("picks the latest attended festival in the same series", async () => {
    const row = await progress(users.sol.client, "2026-09-24");
    expect(row?.previous_festival_name).toBe(`SoloProg ${suffix} 2024`);
    expect(row?.previous_festival_beers).toBe(2);
    expect(row?.previous_festival_days).toBe(1);
  });

  it("counts only this festival's groups and accepted friends", async () => {
    const sol = await progress(users.sol.client, "2026-09-24");
    expect(sol?.groups_this_festival).toBe(0);
    expect(sol?.accepted_friends).toBe(0);
    const soc = await progress(users.soc.client, "2026-09-24");
    expect(soc?.groups_this_festival).toBe(1);
    expect(soc?.accepted_friends).toBe(1);
    expect(soc?.previous_festival_name).toBeNull();
  });

  it("counts Highlights beers from consumptions, not the stale beer_count", async () => {
    const { data, error } = await admin.rpc("get_user_festival_stats_with_positions", {
      p_user_id: users.sol.id,
      p_festival_id: festivalIds.current,
    });
    expect(error).toBeNull();
    expect(Number(data?.[0]?.total_beers)).toBe(4);
  });

  it("is not executable by anon", async () => {
    const { error } = await createTestSupabaseAnon().rpc("get_user_festival_progress", {
      p_festival_id: festivalIds.current,
    });
    expect(error).not.toBeNull();
  });
});
