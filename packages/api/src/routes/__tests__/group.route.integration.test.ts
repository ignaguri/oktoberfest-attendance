import type { Database } from "@prostcounter/db";
import { ErrorCodes } from "@prostcounter/shared/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
} from "../../__tests__/helpers/test-supabase";
import { SupabaseGroupRepository } from "../../repositories/supabase";

// Integration tests using real local Supabase database
// These tests verify the complete flow including RLS policies, triggers, and constraints
describe("Group Routes Integration (Local DB)", () => {
  // Service role client for test setup/teardown (bypasses RLS)
  let supabaseAdmin: SupabaseClient<Database>;
  // Anon client for test operations (respects RLS)
  let supabase: SupabaseClient<Database>;

  let testUser: { id: string; email: string; token: string };
  let testFestival: { id: string; name: string };
  let createdGroupIds: string[] = [];
  // Festivals created by nested suites, cleaned up once at the end. Not reset
  // per test, unlike createdGroupIds.
  const createdFestivalIds: string[] = [];

  beforeAll(async () => {
    // Initialize Supabase clients
    supabaseAdmin = createTestSupabaseAdmin();
    supabase = createTestSupabaseAnon();

    // Create a test user for all integration tests
    const uniqueEmail = `test-${Date.now()}@integration-test.com`;
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: uniqueEmail,
      password: "test-password-123!",
    });

    if (authError || !authData.user || !authData.session) {
      throw new Error(`Failed to create test user: ${authError?.message || "Unknown error"}`);
    }

    testUser = {
      id: authData.user.id,
      email: uniqueEmail,
      token: authData.session.access_token,
    };

    // Create a test festival (using admin client to bypass RLS)
    const { data: festival, error: festivalError } = await supabaseAdmin
      .from("festivals")
      .insert({
        name: `Integration Test Festival ${Date.now()}`,
        short_name: `test-${Date.now()}`,
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

    if (festivalError || !festival) {
      throw new Error(
        `Failed to create test festival: ${festivalError?.message || "Unknown error"}`,
      );
    }

    testFestival = {
      id: festival.id,
      name: festival.name,
    };
  });

  afterAll(async () => {
    // Cleanup: Delete all test data in correct order (respecting foreign keys)
    // Use admin client to bypass RLS policies
    //
    // By festival, not by the tracked createdGroupIds array: beforeEach resets
    // it, so it only ever holds what the LAST test registered and every earlier
    // test's rows survived. groups_festival_id_fkey is RESTRICT, not CASCADE
    // (same for attendances and tent_visits), so the festival delete below then
    // failed silently and each run left orphan festivals behind in the local
    // database. group_members does cascade from groups, but we still delete it
    // explicitly first for clarity/defense in depth.
    const festivalIds = [
      ...(testFestival?.id ? [testFestival.id] : []),
      ...createdFestivalIds,
    ];

    for (const festivalId of festivalIds) {
      const { data: festivalGroups } = await supabaseAdmin
        .from("groups")
        .select("id")
        .eq("festival_id", festivalId);
      const groupIds = (festivalGroups ?? []).map((row) => row.id);

      if (groupIds.length > 0) {
        await supabaseAdmin.from("group_members").delete().in("group_id", groupIds);
      }
      await supabaseAdmin.from("groups").delete().eq("festival_id", festivalId);

      // attendances and tent_visits are also RESTRICT against festivals, so
      // sweep them defensively even though this suite doesn't create them.
      await supabaseAdmin.from("tent_visits").delete().eq("festival_id", festivalId);

      const { data: festivalAttendances } = await supabaseAdmin
        .from("attendances")
        .select("id")
        .eq("festival_id", festivalId);
      const attendanceIds = (festivalAttendances ?? []).map((row) => row.id);

      if (attendanceIds.length > 0) {
        // Must precede attendances: beer_pictures.attendance_id has no cascade.
        await supabaseAdmin.from("beer_pictures").delete().in("attendance_id", attendanceIds);
      }

      await supabaseAdmin.from("attendances").delete().eq("festival_id", festivalId);

      const { error } = await supabaseAdmin.from("festivals").delete().eq("id", festivalId);
      if (error) {
        // eslint-disable-next-line no-console
        console.warn(`Teardown left festival ${festivalId} behind: ${error.message}`);
      }
    }

    // 4. Delete test user (requires admin API)
    await supabaseAdmin.auth.admin.deleteUser(testUser.id).catch(() => {
      // eslint-disable-next-line no-console
      console.warn("Could not delete test user");
    });

    // Sign out
    await supabase.auth.signOut();
  });

  beforeEach(() => {
    // Reset the list of created groups for each test
    createdGroupIds = [];
  });

  it("should create a group and automatically add creator as member", async () => {
    // Use RPC function that bypasses RLS (SECURITY DEFINER)
    // This simulates what the API layer does
    const { data: groupData, error: createError } = await supabaseAdmin.rpc(
      "create_group_with_member",
      {
        p_group_name: "Integration Test Group",
        p_user_id: testUser.id,
        p_festival_id: testFestival.id,
        p_winning_criteria_id: 2, // total_beers
      },
    );

    expect(createError).toBeNull();
    expect(groupData).toBeDefined();
    expect(Array.isArray(groupData)).toBe(true);
    expect(groupData!.length).toBe(1);

    const group = groupData![0];
    expect(group.group_name).toBe("Integration Test Group");
    expect(group.festival_id).toBe(testFestival.id);
    expect(group.created_by).toBe(testUser.id);

    // Track for cleanup
    createdGroupIds.push(group.group_id);

    // Verify the member was added automatically by the RPC function
    const { data: members, error: membersError } = await supabaseAdmin
      .from("group_members")
      .select("*")
      .eq("group_id", group.group_id);

    expect(membersError).toBeNull();
    expect(members).toHaveLength(1);
    expect(members![0].user_id).toBe(testUser.id);
    expect(members![0].group_id).toBe(group.group_id);
  });

  it("should list user's groups with member count", async () => {
    // Create a test group using RPC function
    const { data: groupData } = await supabaseAdmin.rpc("create_group_with_member", {
      p_group_name: "List Test Group",
      p_user_id: testUser.id,
      p_festival_id: testFestival.id,
      p_winning_criteria_id: 1, // days_attended
    });

    const group = groupData![0];
    createdGroupIds.push(group.group_id);

    // List user's groups using admin client (simulating the API layer)
    // The API layer uses service role and filters by user_id
    const { data: groups, error } = await supabaseAdmin
      .from("groups")
      .select(
        `
        *,
        winning_criteria:winning_criteria_id (id, name),
        group_members!inner(user_id)
      `,
      )
      .eq("group_members.user_id", testUser.id)
      .eq("festival_id", testFestival.id);

    expect(error).toBeNull();
    expect(groups).toBeDefined();
    expect(groups!.length).toBeGreaterThanOrEqual(1);

    // Verify the group we just created is in the list
    const ourGroup = groups!.find((g) => g.id === group.group_id);
    expect(ourGroup).toBeDefined();
    expect(ourGroup!.name).toBe("List Test Group");

    // Get member count
    const { count } = await supabaseAdmin
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", group.group_id);

    expect(count).toBe(1);
  });

  it("should prevent duplicate group membership", async () => {
    // Create a test group using RPC function (automatically adds creator as member)
    const { data: groupData } = await supabaseAdmin.rpc("create_group_with_member", {
      p_group_name: "Duplicate Test Group",
      p_user_id: testUser.id,
      p_festival_id: testFestival.id,
      p_winning_criteria_id: 2,
    });

    const group = groupData![0];
    createdGroupIds.push(group.group_id);

    // Creator is already a member from the RPC function
    // Try to add same member again - should fail due to unique constraint
    const { error: secondError } = await supabaseAdmin.from("group_members").insert({
      group_id: group.group_id,
      user_id: testUser.id,
    });

    expect(secondError).not.toBeNull();
    expect(secondError!.code).toBe("23505"); // PostgreSQL unique violation
  });

  describe("carry-over", () => {
    // Exercises SupabaseGroupRepository through the RLS-respecting anon client
    // (signed in as testUser), not the service-role client, because the
    // candidate query depends on RLS narrowing what the caller can see.
    let repo: SupabaseGroupRepository;
    let targetFestival: { id: string; endDate: string };
    // A second real account, so the ownership guard is tested against a
    // created_by that would actually satisfy the foreign key if it got through.
    let otherUserId: string;

    beforeAll(async () => {
      repo = new SupabaseGroupRepository(supabase);

      const { data: otherUser, error: otherUserError } = await supabaseAdmin.auth.admin.createUser({
        email: `other-${Date.now()}@integration-test.com`,
        password: "test-password-123!",
        email_confirm: true,
      });

      if (otherUserError || !otherUser.user) {
        throw new Error(`Failed to create second test user: ${otherUserError?.message}`);
      }

      otherUserId = otherUser.user.id;

      const { data: festival, error } = await supabaseAdmin
        .from("festivals")
        .insert({
          name: `Carry Over Target ${Date.now()}`,
          short_name: `carryover-${Date.now()}`,
          festival_type: "oktoberfest",
          start_date: "2099-09-19",
          end_date: "2099-10-04",
          beer_cost: 16.2,
          location: "Test Location",
          timezone: "Europe/Berlin",
          is_active: false,
          status: "upcoming",
        })
        .select()
        .single();

      if (error || !festival) {
        throw new Error(`Failed to create target festival: ${error?.message}`);
      }

      targetFestival = { id: festival.id, endDate: festival.end_date };
      createdFestivalIds.push(festival.id);
    });

    afterAll(async () => {
      await supabaseAdmin.auth.admin.deleteUser(otherUserId).catch(() => {
        // eslint-disable-next-line no-console
        console.warn("Could not delete second test user");
      });
    });

    // Regression: create_group_with_member is SECURITY DEFINER, granted to
    // authenticated, and reachable straight through PostgREST, so the only thing
    // stopping a caller from passing someone else's p_user_id is a guard inside
    // the function body. Any migration that DROPs and recreates the function
    // drops that guard with it, which is exactly what the carry-over migration
    // did. `supabase` is signed in as testUser, so this is the request an
    // attacker would send verbatim.
    it("refuses to create a group owned by another user", async () => {
      const { error } = await supabase.rpc("create_group_with_member", {
        p_group_name: `Hijack Crew ${Date.now()}`,
        p_user_id: otherUserId,
        p_festival_id: targetFestival.id,
        p_winning_criteria_id: 2,
      });

      // A null error means the RPC went through, i.e. the guard is gone.
      expect(error).not.toBeNull();
      expect(error!.message).toContain("Not authorized to create a group for another user");

      const { data: hijacked } = await supabaseAdmin
        .from("groups")
        .select("id")
        .eq("created_by", otherUserId);
      expect(hijacked).toEqual([]);
    });

    it("carries a group into another festival and records lineage", async () => {
      const { data: created } = await supabaseAdmin.rpc("create_group_with_member", {
        p_group_name: `Carry Crew ${Date.now()}`,
        p_user_id: testUser.id,
        p_festival_id: testFestival.id,
        p_winning_criteria_id: 1, // days_attended, to prove criteria is copied
      });
      const source = created![0];
      createdGroupIds.push(source.group_id);

      // The source group shows up as a candidate for the target festival
      const before = await repo.listCarryOverCandidates(testUser.id, targetFestival.id);
      const candidate = before.find((c) => c.groupId === source.group_id);
      expect(candidate).toBeDefined();
      expect(candidate!.name).toBe(source.group_name);
      expect(candidate!.winningCriteria).toBe("days_attended");
      expect(candidate!.memberCount).toBe(1);
      expect(candidate!.sourceFestivalId).toBe(testFestival.id);
      expect(candidate!.sourceFestivalName).toBe(testFestival.name);

      // Not carried over yet
      expect(await repo.findCarryOverTarget(source.group_id, targetFestival.id)).toBeNull();

      const carried = await repo.carryOver(testUser.id, source.group_id, targetFestival.id);
      createdGroupIds.push(carried.id);

      expect(carried.name).toBe(source.group_name);
      expect(carried.festivalId).toBe(targetFestival.id);
      expect(carried.winningCriteria).toBe("days_attended");
      expect(carried.carriedOverFrom).toBe(source.group_id);
      expect(carried.id).not.toBe(source.group_id);

      // Lineage is queryable, and the candidate disappears from the list
      expect(await repo.findCarryOverTarget(source.group_id, targetFestival.id)).toBe(carried.id);

      const after = await repo.listCarryOverCandidates(testUser.id, targetFestival.id);
      expect(after.find((c) => c.groupId === source.group_id)).toBeUndefined();
    });

    // Regression: the set_group_token BEFORE INSERT trigger overwrites whatever
    // invite_token create_group_with_member is handed, so the function has to read
    // the token back off the inserted row. Returning its own pre-trigger value gave
    // callers a token that exists nowhere, which made every invite link built from
    // a carry-over (including the one in the notification) dead on arrival. Only a
    // real database catches this: with Supabase mocked, the trigger never runs.
    it("returns the invite token that was actually stored", async () => {
      const { data: created } = await supabaseAdmin.rpc("create_group_with_member", {
        p_group_name: `Token Crew ${Date.now()}`,
        p_user_id: testUser.id,
        p_festival_id: testFestival.id,
        p_winning_criteria_id: 1,
      });
      const source = created![0];
      createdGroupIds.push(source.group_id);

      // Plain group creation goes through the same function, so it had the same bug.
      const { data: sourceRow } = await supabaseAdmin
        .from("groups")
        .select("invite_token")
        .eq("id", source.group_id)
        .single();
      expect(source.invite_token).toBe(sourceRow!.invite_token);

      const carried = await repo.carryOver(testUser.id, source.group_id, targetFestival.id);
      createdGroupIds.push(carried.id);

      const { data: carriedRow } = await supabaseAdmin
        .from("groups")
        .select("invite_token")
        .eq("id", carried.id)
        .single();
      expect(carried.inviteToken).toBe(carriedRow!.invite_token);

      // The clone gets its own token, and the link built from it actually resolves.
      expect(carried.inviteToken).not.toBe(source.invite_token);
      const resolved = await repo.findByInviteToken(carried.inviteToken);
      expect(resolved?.id).toBe(carried.id);
    });

    it("rejects a second carry-over of the same group with a name conflict", async () => {
      const { data: created } = await supabaseAdmin.rpc("create_group_with_member", {
        p_group_name: `Dup Crew ${Date.now()}`,
        p_user_id: testUser.id,
        p_festival_id: testFestival.id,
        p_winning_criteria_id: 2,
      });
      const source = created![0];
      createdGroupIds.push(source.group_id);

      const carried = await repo.carryOver(testUser.id, source.group_id, targetFestival.id);
      createdGroupIds.push(carried.id);

      // UNIQUE (name, festival_id) surfaces as a typed conflict, not a raw 500
      await expect(
        repo.carryOver(testUser.id, source.group_id, targetFestival.id),
      ).rejects.toThrow(ErrorCodes.GROUP_NAME_TAKEN);
    });

    // The invite token is the only CTA in the notification the source group's
    // members receive, and set_group_token stamps every new group with a 7-day
    // expiry, so without the override the link dies mid-festival.
    it("keeps the carry-over invite token alive until the festival ends", async () => {
      const { data: created } = await supabaseAdmin.rpc("create_group_with_member", {
        p_group_name: `Expiry Crew ${Date.now()}`,
        p_user_id: testUser.id,
        p_festival_id: testFestival.id,
        p_winning_criteria_id: 2,
      });
      const source = created![0];
      createdGroupIds.push(source.group_id);

      const carried = await repo.carryOver(testUser.id, source.group_id, targetFestival.id);
      createdGroupIds.push(carried.id);

      const { data: rows } = await supabaseAdmin
        .from("groups")
        .select("id, token_expiration")
        .in("id", [source.group_id, carried.id]);

      const sourceExpiry = rows!.find((row) => row.id === source.group_id)!.token_expiration!;
      const carriedExpiry = rows!.find((row) => row.id === carried.id)!.token_expiration!;

      // The source is an ordinary group and keeps the 7-day default.
      expect(sourceExpiry < targetFestival.endDate).toBe(true);
      expect(carriedExpiry > targetFestival.endDate).toBe(true);
    });

    it("does not offer groups from festivals that start after the target", async () => {
      const { data: laterFestival, error: laterError } = await supabaseAdmin
        .from("festivals")
        .insert({
          name: `Carry Over Later ${Date.now()}`,
          short_name: `carryover-later-${Date.now()}`,
          festival_type: "oktoberfest",
          start_date: "2100-09-19",
          end_date: "2100-10-04",
          beer_cost: 16.2,
          location: "Test Location",
          timezone: "Europe/Berlin",
          is_active: false,
          status: "upcoming",
        })
        .select()
        .single();

      if (laterError || !laterFestival) {
        throw new Error(`Failed to create later festival: ${laterError?.message}`);
      }
      createdFestivalIds.push(laterFestival.id);

      const { data: created } = await supabaseAdmin.rpc("create_group_with_member", {
        p_group_name: `Future Crew ${Date.now()}`,
        p_user_id: testUser.id,
        p_festival_id: laterFestival.id,
        p_winning_criteria_id: 2,
      });
      const future = created![0];
      createdGroupIds.push(future.group_id);

      const candidates = await repo.listCarryOverCandidates(testUser.id, targetFestival.id);
      expect(candidates.map((candidate) => candidate.groupId)).not.toContain(future.group_id);
    });

    it("returns the festival end date and timezone, and null for an unknown festival", async () => {
      expect(await repo.getFestivalSchedule(targetFestival.id)).toEqual({
        endDate: targetFestival.endDate,
        timezone: "Europe/Berlin",
      });
      expect(
        await repo.getFestivalSchedule("00000000-0000-0000-0000-000000000000"),
      ).toBeNull();
    });
  });
});
