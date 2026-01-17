import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../__tests__/helpers/test-supabase";

// Integration tests using real local Supabase database
// These tests verify the complete flow including RLS policies, triggers, and constraints
describe("Attendance Routes Integration (Local DB)", () => {
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

  it("should list user's attendances with computed totals and tent visits", async () => {
    // Create authenticated Supabase client for this user
    const userSupabase = createTestSupabaseWithAuth(testUser.token);

    // Create attendance record
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

    // Create consumptions for this attendance
    const { data: consumption1, error: consumption1Error } = await userSupabase
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

    expect(consumption1Error).toBeNull();
    createdConsumptionIds.push(consumption1!.id);

    const { data: consumption2, error: consumption2Error } = await userSupabase
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

    expect(consumption2Error).toBeNull();
    createdConsumptionIds.push(consumption2!.id);

    // Create tent visit for this attendance
    const { data: tentVisit, error: tentVisitError } = await userSupabase
      .from("tent_visits")
      .insert({
        id: randomUUID(),
        user_id: testUser.id,
        festival_id: testFestival.id,
        tent_id: testTent.id,
        visit_date: "2024-09-21T14:00:00Z",
      })
      .select()
      .single();

    expect(tentVisitError).toBeNull();
    createdTentVisitIds.push(tentVisit!.id);

    // Query attendance_with_totals view
    const { data: attendanceList, error: listError } = await userSupabase
      .from("attendance_with_totals")
      .select("*")
      .eq("user_id", testUser.id)
      .eq("festival_id", testFestival.id);

    expect(listError).toBeNull();
    expect(attendanceList).toBeDefined();
    expect(attendanceList!.length).toBeGreaterThanOrEqual(1);

    const ourAttendance = attendanceList!.find((a) => a.id === attendance!.id);
    expect(ourAttendance).toBeDefined();
    expect(ourAttendance!.date).toBe("2024-09-21");
    expect(ourAttendance!.drink_count).toBe(2); // Computed from consumptions
    expect(ourAttendance!.beer_count).toBe(2); // Both are beer type
    expect(ourAttendance!.total_spent_cents).toBe(3260); // 1640 + 1620
    expect(ourAttendance!.total_tip_cents).toBe(20); // Only first has tip
  });

  it("should delete an attendance and cascade to consumptions", async () => {
    // Create authenticated Supabase client for this user
    const userSupabase = createTestSupabaseWithAuth(testUser.token);

    // Create attendance record
    const { data: attendance, error: attendanceError } = await userSupabase
      .from("attendances")
      .insert({
        user_id: testUser.id,
        festival_id: testFestival.id,
        date: "2024-09-22",
      })
      .select()
      .single();

    expect(attendanceError).toBeNull();
    expect(attendance).toBeDefined();
    createdAttendanceIds.push(attendance!.id);

    // Create consumption for this attendance
    const { data: consumption, error: consumptionError } = await userSupabase
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

    expect(consumptionError).toBeNull();
    createdConsumptionIds.push(consumption!.id);

    // Verify attendance exists
    const { data: beforeDelete } = await userSupabase
      .from("attendances")
      .select("*")
      .eq("id", attendance!.id)
      .single();

    expect(beforeDelete).toBeDefined();

    // Delete attendance
    const { error: deleteError } = await userSupabase
      .from("attendances")
      .delete()
      .eq("id", attendance!.id);

    expect(deleteError).toBeNull();

    // Verify attendance is deleted
    const { data: afterDelete, error: afterDeleteError } = await userSupabase
      .from("attendances")
      .select("*")
      .eq("id", attendance!.id)
      .single();

    expect(afterDelete).toBeNull();
    expect(afterDeleteError).not.toBeNull();
    expect(afterDeleteError!.code).toBe("PGRST116"); // Not found

    // Verify consumption is also deleted (cascade)
    const { data: consumptionAfterDelete, error: consumptionAfterDeleteError } =
      await userSupabase
        .from("consumptions")
        .select("*")
        .eq("id", consumption!.id)
        .single();

    expect(consumptionAfterDelete).toBeNull();
    expect(consumptionAfterDeleteError).not.toBeNull();
    expect(consumptionAfterDeleteError!.code).toBe("PGRST116"); // Not found

    // Remove from tracking since already deleted
    createdAttendanceIds = createdAttendanceIds.filter(
      (id) => id !== attendance!.id,
    );
    createdConsumptionIds = createdConsumptionIds.filter(
      (id) => id !== consumption!.id,
    );
  });

  it("should prevent user from deleting another user's attendance (RLS)", async () => {
    // Create authenticated Supabase client for user 1
    const user1Supabase = createTestSupabaseWithAuth(testUser.token);

    // Create attendance for user 1
    const { data: attendance, error: attendanceError } = await user1Supabase
      .from("attendances")
      .insert({
        user_id: testUser.id,
        festival_id: testFestival.id,
        date: "2024-09-23",
      })
      .select()
      .single();

    expect(attendanceError).toBeNull();
    expect(attendance).toBeDefined();
    createdAttendanceIds.push(attendance!.id);

    // Create authenticated Supabase client for user 2
    const user2Supabase = createTestSupabaseWithAuth(testUser2.token);

    // Try to delete user 1's attendance as user 2 - should fail due to RLS
    // Note: Supabase/PostgREST doesn't return an error when RLS filters out rows.
    // It returns an empty result instead (no rows affected).
    const { data: deleteResult, error: deleteError } = await user2Supabase
      .from("attendances")
      .delete()
      .eq("id", attendance!.id)
      .select();

    // RLS should either:
    // 1. Return an error, OR
    // 2. Return no rows affected (empty array)
    const rlsBlocked =
      deleteError !== null || (deleteResult && deleteResult.length === 0);
    expect(rlsBlocked).toBe(true);

    // Verify attendance still exists (using admin client)
    const { data: stillExists } = await supabaseAdmin
      .from("attendances")
      .select("*")
      .eq("id", attendance!.id)
      .single();

    expect(stillExists).toBeDefined();
    expect(stillExists!.user_id).toBe(testUser.id);
  });

  it("should support pagination for attendance list", async () => {
    // Create authenticated Supabase client for this user
    const userSupabase = createTestSupabaseWithAuth(testUser.token);

    // Create 3 attendance records
    const dates = ["2024-09-24", "2024-09-25", "2024-09-26"];
    for (const date of dates) {
      const { data: attendance } = await userSupabase
        .from("attendances")
        .insert({
          user_id: testUser.id,
          festival_id: testFestival.id,
          date,
        })
        .select()
        .single();

      if (attendance) {
        createdAttendanceIds.push(attendance.id);
      }
    }

    // Test pagination: Get first 2 results
    const { data: page1, error: page1Error } = await userSupabase
      .from("attendance_with_totals")
      .select("*")
      .eq("user_id", testUser.id)
      .eq("festival_id", testFestival.id)
      .order("date", { ascending: false })
      .range(0, 1); // First 2 results (offset 0, limit 2)

    expect(page1Error).toBeNull();
    expect(page1).toBeDefined();
    expect(page1!.length).toBeLessThanOrEqual(2);

    // Test pagination: Get next results
    const { data: page2, error: page2Error } = await userSupabase
      .from("attendance_with_totals")
      .select("*")
      .eq("user_id", testUser.id)
      .eq("festival_id", testFestival.id)
      .order("date", { ascending: false })
      .range(2, 3); // Next 2 results (offset 2, limit 2)

    expect(page2Error).toBeNull();
    expect(page2).toBeDefined();

    // Get total count
    const { count } = await userSupabase
      .from("attendance_with_totals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", testUser.id)
      .eq("festival_id", testFestival.id);

    expect(count).toBeGreaterThanOrEqual(3);
  });
});
