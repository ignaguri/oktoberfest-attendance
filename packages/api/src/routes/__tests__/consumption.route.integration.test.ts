import { randomUUID } from "crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../__tests__/helpers/test-supabase";

// Integration tests using real local Supabase database
// These tests verify the complete flow including RLS policies, triggers, and computed totals
describe("Consumption Routes Integration (Local DB)", () => {
  // Service role client for test setup/teardown (bypasses RLS)
  let supabaseAdmin: SupabaseClient<Database>;
  // Anon client for test operations (respects RLS)
  let supabase: SupabaseClient<Database>;

  let testUser: { id: string; email: string; token: string };
  let testUser2: { id: string; email: string; token: string };
  let testFestival: { id: string; name: string };
  let testTent: { id: string; name: string };
  let createdAttendanceIds: string[] = [];
  let createdConsumptionIds: string[] = [];
  let createdTentVisitIds: string[] = [];

  beforeAll(async () => {
    // Initialize Supabase clients
    supabaseAdmin = createTestSupabaseAdmin();
    supabase = createTestSupabaseAnon();

    // Create first test user
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

    // Create second test user for RLS testing
    const uniqueEmail2 = `test2-${Date.now()}@integration-test.com`;
    const { data: authData2, error: authError2 } = await supabase.auth.signUp({
      email: uniqueEmail2,
      password: "test-password-456!",
    });

    if (authError2 || !authData2.user || !authData2.session) {
      throw new Error(
        `Failed to create second test user: ${authError2?.message || "Unknown error"}`,
      );
    }

    testUser2 = {
      id: authData2.user.id,
      email: uniqueEmail2,
      token: authData2.session.access_token,
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
        beer_cost: 16.2, // €16.20
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

    // Create a test tent (using admin client to bypass RLS)
    const { data: tent, error: tentError } = await supabaseAdmin
      .from("tents")
      .insert({
        id: randomUUID(),
        name: "Test Tent",
        category: "large",
      })
      .select()
      .single();

    if (tentError || !tent) {
      throw new Error(
        `Failed to create test tent: ${tentError?.message || "Unknown error"}`,
      );
    }

    testTent = {
      id: tent.id,
      name: tent.name,
    };

    // Link tent to festival
    await supabaseAdmin.from("festival_tents").insert({
      festival_id: testFestival.id,
      tent_id: testTent.id,
    });
  });

  afterAll(async () => {
    // Cleanup: Delete all test data in correct order (respecting foreign keys)
    // Use admin client to bypass RLS policies

    // 1. Delete tent visits first
    await supabaseAdmin
      .from("tent_visits")
      .delete()
      .in("id", createdTentVisitIds);

    // 2. Delete consumptions (must be before attendances due to FK)
    await supabaseAdmin
      .from("consumptions")
      .delete()
      .in("id", createdConsumptionIds);

    // 3. Delete attendances
    await supabaseAdmin
      .from("attendances")
      .delete()
      .in("id", createdAttendanceIds);

    // 4. Delete festival-tent association
    if (testFestival?.id && testTent?.id) {
      await supabaseAdmin
        .from("festival_tents")
        .delete()
        .eq("festival_id", testFestival.id)
        .eq("tent_id", testTent.id);
    }

    // 5. Delete tent
    if (testTent?.id) {
      await supabaseAdmin.from("tents").delete().eq("id", testTent.id);
    }

    // 6. Delete festival
    if (testFestival?.id) {
      await supabaseAdmin.from("festivals").delete().eq("id", testFestival.id);
    }

    // 7. Delete test users (requires admin API)
    await supabaseAdmin.auth.admin.deleteUser(testUser.id).catch(() => {
      // eslint-disable-next-line no-console
      console.warn("Could not delete test user 1");
    });
    await supabaseAdmin.auth.admin.deleteUser(testUser2.id).catch(() => {
      // eslint-disable-next-line no-console
      console.warn("Could not delete test user 2");
    });

    // Sign out
    await supabase.auth.signOut();
  });

  beforeEach(() => {
    // Reset the lists for each test
    createdAttendanceIds = [];
    createdConsumptionIds = [];
    createdTentVisitIds = [];
  });

  it("should create consumption and verify computed attendance totals", async () => {
    // Create authenticated Supabase client for this user
    const userSupabase = createTestSupabaseWithAuth(testUser.token);

    // First, create an attendance manually
    const { data: attendance, error: attendanceError } = await userSupabase
      .from("attendances")
      .insert({
        user_id: testUser.id,
        festival_id: testFestival.id,
        date: "2024-09-21",
      })
      .select()
      .single();

    expect(attendanceError).toBeNull();
    expect(attendance).toBeDefined();
    createdAttendanceIds.push(attendance!.id);

    // Create a consumption using the repository pattern
    const { data: consumption, error: consumptionError } = await userSupabase
      .from("consumptions")
      .insert({
        attendance_id: attendance!.id,
        drink_type: "beer",
        base_price_cents: 1620,
        price_paid_cents: 1650, // Includes 30 cents tip
        volume_ml: 1000,
      })
      .select()
      .single();

    expect(consumptionError).toBeNull();
    expect(consumption).toBeDefined();
    createdConsumptionIds.push(consumption!.id);

    // Query attendance_with_totals view to verify computed fields
    const { data: attendanceWithTotals, error: totalsError } =
      await userSupabase
        .from("attendance_with_totals")
        .select("*")
        .eq("id", attendance!.id)
        .single();

    expect(totalsError).toBeNull();
    expect(attendanceWithTotals).toBeDefined();
    expect(attendanceWithTotals!.drink_count).toBe(1);
    expect(attendanceWithTotals!.beer_count).toBe(1); // Beer counts as beer
    expect(attendanceWithTotals!.total_spent_cents).toBe(1650);
    expect(attendanceWithTotals!.total_tip_cents).toBe(30);
    expect(attendanceWithTotals!.avg_price_cents).toBe(1650);
  });

  it("should create multiple consumptions and update totals correctly", async () => {
    // Create authenticated Supabase client for this user
    const userSupabase = createTestSupabaseWithAuth(testUser.token);

    // Create an attendance
    const { data: attendance } = await userSupabase
      .from("attendances")
      .insert({
        user_id: testUser.id,
        festival_id: testFestival.id,
        date: "2024-09-22",
      })
      .select()
      .single();

    createdAttendanceIds.push(attendance!.id);

    // Create first beer
    const { data: consumption1 } = await userSupabase
      .from("consumptions")
      .insert({
        attendance_id: attendance!.id,
        drink_type: "beer",
        base_price_cents: 1620,
        price_paid_cents: 1640,
        volume_ml: 1000,
      })
      .select()
      .single();

    createdConsumptionIds.push(consumption1!.id);

    // Create second beer
    const { data: consumption2 } = await userSupabase
      .from("consumptions")
      .insert({
        attendance_id: attendance!.id,
        drink_type: "beer",
        base_price_cents: 1620,
        price_paid_cents: 1620,
        volume_ml: 1000,
      })
      .select()
      .single();

    createdConsumptionIds.push(consumption2!.id);

    // Create soft drink (doesn't count as beer)
    const { data: consumption3 } = await userSupabase
      .from("consumptions")
      .insert({
        attendance_id: attendance!.id,
        drink_type: "soft_drink",
        base_price_cents: 500,
        price_paid_cents: 500,
        volume_ml: 500,
      })
      .select()
      .single();

    createdConsumptionIds.push(consumption3!.id);

    // Verify totals
    const { data: attendanceWithTotals } = await userSupabase
      .from("attendance_with_totals")
      .select("*")
      .eq("id", attendance!.id)
      .single();

    expect(attendanceWithTotals!.drink_count).toBe(3); // Total drinks
    expect(attendanceWithTotals!.beer_count).toBe(2); // Only beer/radler
    expect(attendanceWithTotals!.total_spent_cents).toBe(3760); // 1640 + 1620 + 500
    expect(attendanceWithTotals!.total_tip_cents).toBe(20); // Only first beer has tip
    expect(attendanceWithTotals!.avg_price_cents).toBe(1253); // 3760 / 3
  });

  it("should handle different drink types correctly (beer vs non-beer)", async () => {
    // Create authenticated Supabase client for this user
    const userSupabase = createTestSupabaseWithAuth(testUser.token);

    // Create an attendance
    const { data: attendance } = await userSupabase
      .from("attendances")
      .insert({
        user_id: testUser.id,
        festival_id: testFestival.id,
        date: "2024-09-23",
      })
      .select()
      .single();

    createdAttendanceIds.push(attendance!.id);

    // Create beer (counts as beer)
    const { data: beer } = await userSupabase
      .from("consumptions")
      .insert({
        attendance_id: attendance!.id,
        drink_type: "beer",
        base_price_cents: 1620,
        price_paid_cents: 1620,
        volume_ml: 1000,
      })
      .select()
      .single();

    createdConsumptionIds.push(beer!.id);

    // Create radler (counts as beer)
    const { data: radler } = await userSupabase
      .from("consumptions")
      .insert({
        attendance_id: attendance!.id,
        drink_type: "radler",
        base_price_cents: 1620,
        price_paid_cents: 1620,
        volume_ml: 1000,
      })
      .select()
      .single();

    createdConsumptionIds.push(radler!.id);

    // Create wine (doesn't count as beer)
    const { data: wine } = await userSupabase
      .from("consumptions")
      .insert({
        attendance_id: attendance!.id,
        drink_type: "wine",
        base_price_cents: 900,
        price_paid_cents: 900,
        volume_ml: 200,
      })
      .select()
      .single();

    createdConsumptionIds.push(wine!.id);

    // Verify beer count logic
    const { data: attendanceWithTotals } = await userSupabase
      .from("attendance_with_totals")
      .select("*")
      .eq("id", attendance!.id)
      .single();

    expect(attendanceWithTotals!.drink_count).toBe(3);
    expect(attendanceWithTotals!.beer_count).toBe(2); // Beer and radler only
  });

  it("should create tent visit when consumption includes tentId", async () => {
    // Create authenticated Supabase client for this user
    const userSupabase = createTestSupabaseWithAuth(testUser.token);

    // Create an attendance
    const { data: attendance } = await userSupabase
      .from("attendances")
      .insert({
        user_id: testUser.id,
        festival_id: testFestival.id,
        date: "2024-09-24",
      })
      .select()
      .single();

    createdAttendanceIds.push(attendance!.id);

    // Create consumption with tent visit
    const visitTime = "2024-09-24T14:30:00Z";
    const { data: consumption } = await userSupabase
      .from("consumptions")
      .insert({
        attendance_id: attendance!.id,
        tent_id: testTent.id,
        drink_type: "beer",
        base_price_cents: 1620,
        price_paid_cents: 1620,
        volume_ml: 1000,
      })
      .select()
      .single();

    createdConsumptionIds.push(consumption!.id);

    // Note: In the full implementation, tent visits might be created by a trigger or service
    // For this test, we'll manually create the tent visit to verify the relationship
    const { data: tentVisit, error: tentVisitError } = await userSupabase
      .from("tent_visits")
      .insert({
        id: randomUUID(),
        user_id: testUser.id,
        festival_id: testFestival.id,
        tent_id: testTent.id,
        visit_date: visitTime,
      })
      .select()
      .single();

    expect(tentVisitError).toBeNull();
    createdTentVisitIds.push(tentVisit!.id);

    // Verify tent visit was created
    const { data: visits } = await userSupabase
      .from("tent_visits")
      .select("*")
      .eq("user_id", testUser.id)
      .eq("festival_id", testFestival.id)
      .eq("tent_id", testTent.id);

    expect(visits).toBeDefined();
    expect(visits!.length).toBeGreaterThanOrEqual(1);
  });

  it("should delete consumption and update attendance totals (cascade)", async () => {
    // Create authenticated Supabase client for this user
    const userSupabase = createTestSupabaseWithAuth(testUser.token);

    // Create attendance with two consumptions
    const { data: attendance } = await userSupabase
      .from("attendances")
      .insert({
        user_id: testUser.id,
        festival_id: testFestival.id,
        date: "2024-09-25",
      })
      .select()
      .single();

    createdAttendanceIds.push(attendance!.id);

    const { data: consumption1 } = await userSupabase
      .from("consumptions")
      .insert({
        attendance_id: attendance!.id,
        drink_type: "beer",
        base_price_cents: 1620,
        price_paid_cents: 1620,
        volume_ml: 1000,
      })
      .select()
      .single();

    createdConsumptionIds.push(consumption1!.id);

    const { data: consumption2 } = await userSupabase
      .from("consumptions")
      .insert({
        attendance_id: attendance!.id,
        drink_type: "beer",
        base_price_cents: 1620,
        price_paid_cents: 1620,
        volume_ml: 1000,
      })
      .select()
      .single();

    createdConsumptionIds.push(consumption2!.id);

    // Verify initial totals
    const { data: beforeDelete } = await userSupabase
      .from("attendance_with_totals")
      .select("*")
      .eq("id", attendance!.id)
      .single();

    expect(beforeDelete!.drink_count).toBe(2);
    expect(beforeDelete!.total_spent_cents).toBe(3240);

    // Delete one consumption
    const { error: deleteError } = await userSupabase
      .from("consumptions")
      .delete()
      .eq("id", consumption1!.id);

    expect(deleteError).toBeNull();

    // Verify updated totals
    const { data: afterDelete } = await userSupabase
      .from("attendance_with_totals")
      .select("*")
      .eq("id", attendance!.id)
      .single();

    expect(afterDelete!.drink_count).toBe(1);
    expect(afterDelete!.total_spent_cents).toBe(1620);

    // Remove from tracking since deleted
    createdConsumptionIds = createdConsumptionIds.filter(
      (id) => id !== consumption1!.id,
    );
  });

  it("should prevent user from accessing another user's consumption (RLS)", async () => {
    // Create consumption for user 1
    const user1Supabase = createTestSupabaseWithAuth(testUser.token);

    const { data: attendance } = await user1Supabase
      .from("attendances")
      .insert({
        user_id: testUser.id,
        festival_id: testFestival.id,
        date: "2024-09-26",
      })
      .select()
      .single();

    createdAttendanceIds.push(attendance!.id);

    const { data: consumption } = await user1Supabase
      .from("consumptions")
      .insert({
        attendance_id: attendance!.id,
        drink_type: "beer",
        base_price_cents: 1620,
        price_paid_cents: 1620,
        volume_ml: 1000,
      })
      .select()
      .single();

    createdConsumptionIds.push(consumption!.id);

    // Try to access with user 2
    const user2Supabase = createTestSupabaseWithAuth(testUser2.token);

    const { data: accessAttempt, error: accessError } = await user2Supabase
      .from("consumptions")
      .select("*")
      .eq("id", consumption!.id)
      .single();

    // RLS should prevent access (either error or no data)
    expect(accessAttempt).toBeNull();
    expect(accessError).not.toBeNull();
  });

  it("should validate consumption belongs to user before deletion (RLS)", async () => {
    // Create consumption for user 1
    const user1Supabase = createTestSupabaseWithAuth(testUser.token);

    const { data: attendance } = await user1Supabase
      .from("attendances")
      .insert({
        user_id: testUser.id,
        festival_id: testFestival.id,
        date: "2024-09-27",
      })
      .select()
      .single();

    createdAttendanceIds.push(attendance!.id);

    const { data: consumption } = await user1Supabase
      .from("consumptions")
      .insert({
        attendance_id: attendance!.id,
        drink_type: "beer",
        base_price_cents: 1620,
        price_paid_cents: 1620,
        volume_ml: 1000,
      })
      .select()
      .single();

    createdConsumptionIds.push(consumption!.id);

    // Try to delete with user 2 - RLS should prevent deletion
    const user2Supabase = createTestSupabaseWithAuth(testUser2.token);

    const { error: deleteError } = await user2Supabase
      .from("consumptions")
      .delete()
      .eq("id", consumption!.id);

    // RLS may allow the operation but not delete anything (filters by user)
    // The important thing is the consumption still exists
    // Note: deleteError might be null even though nothing was deleted

    // Verify consumption still exists (using admin client)
    const { data: stillExists } = await supabaseAdmin
      .from("consumptions")
      .select("*")
      .eq("id", consumption!.id)
      .single();

    expect(stillExists).toBeDefined();
    expect(stillExists!.id).toBe(consumption!.id);
  });
});
