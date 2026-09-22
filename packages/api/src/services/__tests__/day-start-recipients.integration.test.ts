// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test:integration -- day-start-recipients
//
// get_day_start_recipients is SECURITY DEFINER and its group branch reads
// v_user_shared_group_members, a security_invoker view. Its rows are only
// visible inside the function because the function's owning role has
// BYPASSRLS — if ownership ever changes, the function silently returns zero
// group-mates instead of erroring. A test suite that only proves strangers
// stay excluded would keep passing after that regression, so this file
// asserts real recipients (a friend, a group-mate) actually come back.
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@prostcounter/db";

import { createTestSupabaseAdmin, createTestSupabaseAnon } from "../../__tests__/helpers/test-supabase";

// Created lazily in beforeAll, not at module scope: setup.ts loads the local
// Supabase env vars from .env.test/.env.local inside a beforeAll hook, which
// runs after this file's top-level code, so building the admin client at
// import time reads env vars before they exist.
let supabaseAdmin: SupabaseClient<Database>;
const createdUserIds: string[] = [];
const createdFestivalIds: string[] = [];

async function createTestUser(label: string) {
  const supabaseAnon = createTestSupabaseAnon();
  const email = `day-start-${label}-${randomUUID()}@integration-test.com`;
  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password: "test-password-123!",
  });
  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message ?? "unknown error"}`);
  }
  createdUserIds.push(data.user.id);
  return data.user.id;
}

async function createTestFestival() {
  const suffix = randomUUID();
  const { data: festival, error } = await supabaseAdmin
    .from("festivals")
    .insert({
      name: `Day Start Recipients Test ${suffix}`,
      short_name: `day-start-${suffix}`.slice(0, 40),
      festival_type: "oktoberfest",
      start_date: "2024-09-21",
      end_date: "2024-10-06",
      beer_cost: 16.2,
      location: "Test Location",
      timezone: "Europe/Berlin",
      is_active: false,
      status: "ended",
    })
    .select()
    .single();
  if (error || !festival) {
    throw new Error(`Failed to create test festival: ${error?.message}`);
  }
  createdFestivalIds.push(festival.id);
  return festival.id as string;
}

async function recipientsOf(actorId: string, festivalId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.rpc("get_day_start_recipients", {
    p_actor_id: actorId,
    p_festival_id: festivalId,
  });
  if (error) {
    throw new Error(`get_day_start_recipients failed: ${error.message}`);
  }
  return (data ?? []) as string[];
}

describe("get_day_start_recipients", () => {
  beforeAll(() => {
    supabaseAdmin = createTestSupabaseAdmin();
  });

  afterAll(async () => {
    for (const festivalId of createdFestivalIds) {
      const { data: groups } = await supabaseAdmin
        .from("groups")
        .select("id")
        .eq("festival_id", festivalId);
      const groupIds = (groups ?? []).map((group) => group.id);
      if (groupIds.length > 0) {
        await supabaseAdmin.from("group_members").delete().in("group_id", groupIds);
      }
      await supabaseAdmin.from("groups").delete().eq("festival_id", festivalId);
      await supabaseAdmin.from("festivals").delete().eq("id", festivalId);
    }
    for (const userId of createdUserIds) {
      await supabaseAdmin
        .from("friendships")
        .delete()
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        console.warn(`Failed to delete test user ${userId}: ${error.message}`);
      }
    }
  });

  it("returns a real group-mate sharing the actor's festival", async () => {
    const festivalId = await createTestFestival();
    const actorId = await createTestUser("actor-group");
    const groupmateId = await createTestUser("groupmate");

    const { data: group, error: groupError } = await supabaseAdmin.rpc(
      "create_group_with_member",
      {
        p_group_name: `Day Start Group ${randomUUID()}`,
        p_user_id: actorId,
        p_festival_id: festivalId,
        p_winning_criteria_id: 2,
      },
    );
    if (groupError || !group?.[0]) {
      throw new Error(`Failed to create test group: ${groupError?.message}`);
    }

    const { error: memberError } = await supabaseAdmin
      .from("group_members")
      .insert({ user_id: groupmateId, group_id: group[0].group_id });
    if (memberError) {
      throw new Error(`Failed to add group member: ${memberError.message}`);
    }

    const recipients = await recipientsOf(actorId, festivalId);

    // The positive assertion: this is the branch that would silently return
    // nothing if the function ever lost BYPASSRLS on its owning role.
    expect(recipients).toContain(groupmateId);
    expect(recipients).not.toContain(actorId);
  });

  it("returns an accepted friend", async () => {
    const festivalId = await createTestFestival();
    const actorId = await createTestUser("actor-friend");
    const friendId = await createTestUser("friend");

    const { error: friendError } = await supabaseAdmin.from("friendships").insert({
      requester_id: actorId,
      addressee_id: friendId,
      status: "accepted",
    });
    if (friendError) {
      throw new Error(`Failed to create friendship: ${friendError.message}`);
    }

    const recipients = await recipientsOf(actorId, festivalId);

    expect(recipients).toContain(friendId);
  });

  it("excludes a user with no friendship and no shared group", async () => {
    const festivalId = await createTestFestival();
    const actorId = await createTestUser("actor-stranger");
    const strangerId = await createTestUser("stranger");

    const recipients = await recipientsOf(actorId, festivalId);

    expect(recipients).not.toContain(strangerId);
  });
});

// The exactly-once claim is the whole point of the ledger: ON CONFLICT DO
// NOTHING ... RETURNING must hand a row to the first writer and nothing to
// the second for the same (actor, festival, date). notifyDayStart's own test
// suite only asserts against a mock that is told what to return, so it can
// never catch this behavior actually breaking (e.g. a typo'd onConflict
// column list, or a unique constraint that stops matching the upsert). This
// runs the real upsert against the real table.
describe("day_start_notifications ledger claim", () => {
  let ledgerFestivalId: string;
  let ledgerActorId: string;
  const ledgerDate = "2026-09-22";

  beforeAll(async () => {
    supabaseAdmin = createTestSupabaseAdmin();
    ledgerFestivalId = await createTestFestival();
    ledgerActorId = await createTestUser("ledger-actor");
  });

  afterAll(async () => {
    await supabaseAdmin
      .from("day_start_notifications")
      .delete()
      .eq("actor_id", ledgerActorId)
      .eq("festival_id", ledgerFestivalId)
      .eq("date", ledgerDate);
    await supabaseAdmin.from("festivals").delete().eq("id", ledgerFestivalId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(ledgerActorId);
    if (error) {
      console.warn(`Failed to delete test user ${ledgerActorId}: ${error.message}`);
    }
  });

  it("hands the claim to the first writer only, for the same actor/festival/date", async () => {
    const claimRow = {
      actor_id: ledgerActorId,
      festival_id: ledgerFestivalId,
      date: ledgerDate,
    };
    const upsertOptions = { onConflict: "actor_id,festival_id,date", ignoreDuplicates: true };

    const first = await supabaseAdmin
      .from("day_start_notifications")
      .upsert(claimRow, upsertOptions)
      .select("actor_id");

    const second = await supabaseAdmin
      .from("day_start_notifications")
      .upsert(claimRow, upsertOptions)
      .select("actor_id");

    expect(first.error).toBeNull();
    expect(first.data).toHaveLength(1);
    expect(second.error).toBeNull();
    expect(second.data).toHaveLength(0);
  });
});
