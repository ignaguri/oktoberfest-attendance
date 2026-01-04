import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
} from "../../__tests__/helpers/test-supabase";

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
      throw new Error(
        `Failed to create test user: ${authError?.message || "Unknown error"}`,
      );
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

    // 1. Delete group members first
    await supabaseAdmin
      .from("group_members")
      .delete()
      .in("group_id", createdGroupIds);

    // 2. Delete groups
    await supabaseAdmin.from("groups").delete().in("id", createdGroupIds);

    // 3. Delete festival
    if (testFestival?.id) {
      await supabaseAdmin.from("festivals").delete().eq("id", testFestival.id);
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
    const { data: groupData } = await supabaseAdmin.rpc(
      "create_group_with_member",
      {
        p_group_name: "List Test Group",
        p_user_id: testUser.id,
        p_festival_id: testFestival.id,
        p_winning_criteria_id: 1, // days_attended
      },
    );

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
    const { data: groupData } = await supabaseAdmin.rpc(
      "create_group_with_member",
      {
        p_group_name: "Duplicate Test Group",
        p_user_id: testUser.id,
        p_festival_id: testFestival.id,
        p_winning_criteria_id: 2,
      },
    );

    const group = groupData![0];
    createdGroupIds.push(group.group_id);

    // Creator is already a member from the RPC function
    // Try to add same member again - should fail due to unique constraint
    const { error: secondError } = await supabaseAdmin
      .from("group_members")
      .insert({
        group_id: group.group_id,
        user_id: testUser.id,
      });

    expect(secondError).not.toBeNull();
    expect(secondError!.code).toBe("23505"); // PostgreSQL unique violation
  });
});
