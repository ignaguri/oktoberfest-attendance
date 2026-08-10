import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ErrorCodes } from "@prostcounter/shared/errors";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../__tests__/helpers/test-supabase";
import { SupabaseAttendanceRepository } from "../../repositories/supabase";

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
      throw new Error(`Failed to create test user: ${authError?.message || "Unknown error"}`);
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
      throw new Error(`Failed to create test tent: ${tentError?.message || "Unknown error"}`);
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
    await supabaseAdmin.from("tent_visits").delete().in("id", createdTentVisitIds);

    // 2. Delete consumptions (must be before attendances due to FK)
    await supabaseAdmin.from("consumptions").delete().in("id", createdConsumptionIds);

    // 3. Delete attendances
    await supabaseAdmin.from("attendances").delete().in("id", createdAttendanceIds);

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
    const { data: consumptionAfterDelete, error: consumptionAfterDeleteError } = await userSupabase
      .from("consumptions")
      .select("*")
      .eq("id", consumption!.id)
      .single();

    expect(consumptionAfterDelete).toBeNull();
    expect(consumptionAfterDeleteError).not.toBeNull();
    expect(consumptionAfterDeleteError!.code).toBe("PGRST116"); // Not found

    // Remove from tracking since already deleted
    createdAttendanceIds = createdAttendanceIds.filter((id) => id !== attendance!.id);
    createdConsumptionIds = createdConsumptionIds.filter((id) => id !== consumption!.id);
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
    const rlsBlocked = deleteError !== null || (deleteResult && deleteResult.length === 0);
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

  describe("update_personal_attendance_with_tents tent_ids contract", () => {
    // A date per test: cleanup only runs in afterAll, so sharing one date would
    // let the first test's seeded visit leak into the second's count.
    const nullCaseDate = "2024-09-25T14:00:00Z";
    const clearCaseDate = "2024-09-26T14:00:00Z";
    const duplicateCaseDate = "2024-09-27T14:00:00Z";

    // The outer beforeEach resets createdTentVisitIds, so the outer afterAll only
    // ever sees ids the LAST test registered: a row this block deliberately keeps
    // alive (the null case) would leak into the local database on every run. Clean
    // up by probe date instead of relying on that tracking.
    afterAll(async () => {
      await supabaseAdmin
        .from("tent_visits")
        .delete()
        .eq("user_id", testUser.id)
        .in("visit_date", [nullCaseDate, clearCaseDate, duplicateCaseDate]);
    });

    /** Seeds one tent visit on the given date and returns its id. */
    async function seedTentVisit(
      userSupabase: SupabaseClient<Database>,
      date: string,
    ): Promise<string> {
      const { data: tentVisit, error } = await userSupabase
        .from("tent_visits")
        .insert({
          id: randomUUID(),
          user_id: testUser.id,
          festival_id: testFestival.id,
          tent_id: testTent.id,
          visit_date: date,
        })
        .select()
        .single();

      expect(error).toBeNull();
      createdTentVisitIds.push(tentVisit!.id);
      return tentVisit!.id;
    }

    async function countVisitsOnDate(
      userSupabase: SupabaseClient<Database>,
      date: string,
    ): Promise<number> {
      const dayStart = `${date.slice(0, 10)}T00:00:00Z`;
      const dayEnd = new Date(Date.parse(dayStart) + 24 * 60 * 60 * 1000).toISOString();

      const { count } = await userSupabase
        .from("tent_visits")
        .select("*", { count: "exact", head: true })
        .eq("user_id", testUser.id)
        .eq("festival_id", testFestival.id)
        .gte("visit_date", dayStart)
        .lt("visit_date", dayEnd);
      return count ?? 0;
    }

    // Regression: null and [] used to be treated identically, so a client that
    // lost track of the tent array silently deleted the day's tent visits. The
    // mobile attendance form did exactly that on every edit.
    it("leaves tent visits untouched when p_tent_ids is null", async () => {
      const userSupabase = createTestSupabaseWithAuth(testUser.token);
      const tentVisitId = await seedTentVisit(userSupabase, nullCaseDate);

      const { data, error } = await userSupabase.rpc("update_personal_attendance_with_tents", {
        p_user_id: testUser.id,
        p_date: nullCaseDate,
        p_beer_count: 0,
        p_tent_ids: null as unknown as string[],
        p_festival_id: testFestival.id,
      });

      expect(error).toBeNull();
      createdAttendanceIds.push(data![0].attendance_id);
      expect(data![0].tents_removed).toEqual([]);

      const { data: survivor } = await userSupabase
        .from("tent_visits")
        .select("id")
        .eq("id", tentVisitId)
        .maybeSingle();
      expect(survivor).not.toBeNull();
    });

    it("clears tent visits and reports them when p_tent_ids is an empty array", async () => {
      const userSupabase = createTestSupabaseWithAuth(testUser.token);
      await seedTentVisit(userSupabase, clearCaseDate);
      expect(await countVisitsOnDate(userSupabase, clearCaseDate)).toBe(1);

      const { data, error } = await userSupabase.rpc("update_personal_attendance_with_tents", {
        p_user_id: testUser.id,
        p_date: clearCaseDate,
        p_beer_count: 0,
        p_tent_ids: [],
        p_festival_id: testFestival.id,
      });

      expect(error).toBeNull();
      createdAttendanceIds.push(data![0].attendance_id);

      // The old implementation deleted the rows but reported an empty array,
      // so the deletion was unobservable to callers.
      expect(data![0].tents_removed).toEqual([testTent.id]);
      expect(await countVisitsOnDate(userSupabase, clearCaseDate)).toBe(0);
    });

    // p_tent_ids is a set to reconcile to, but nothing upstream guarantees it is
    // distinct and tent_visits has no unique index to fall back on, so a repeated
    // id used to write one row per occurrence and report the tent twice.
    it("writes one tent visit when p_tent_ids repeats a tent", async () => {
      const userSupabase = createTestSupabaseWithAuth(testUser.token);

      const { data, error } = await userSupabase.rpc("update_personal_attendance_with_tents", {
        p_user_id: testUser.id,
        p_date: duplicateCaseDate,
        p_beer_count: 0,
        p_tent_ids: [testTent.id, testTent.id],
        p_festival_id: testFestival.id,
      });

      expect(error).toBeNull();
      createdAttendanceIds.push(data![0].attendance_id);

      // Register whatever the RPC inserted so afterAll can clean it up, since
      // these rows were not seeded through seedTentVisit.
      const dayStart = `${duplicateCaseDate.slice(0, 10)}T00:00:00Z`;
      const { data: written } = await userSupabase
        .from("tent_visits")
        .select("id")
        .eq("user_id", testUser.id)
        .eq("festival_id", testFestival.id)
        .gte("visit_date", dayStart)
        .lt("visit_date", new Date(Date.parse(dayStart) + 24 * 60 * 60 * 1000).toISOString());
      createdTentVisitIds.push(...(written ?? []).map((row) => row.id));

      expect(data![0].tents_added).toEqual([testTent.id]);
      expect(await countVisitsOnDate(userSupabase, duplicateCaseDate)).toBe(1);
    });
  });

  // A day is a sequence of visits, not just a set of tents: leaving a tent and
  // coming back later is two visits. logTentVisit is the only writer that can
  // say so. update_personal_attendance_with_tents reconciles the day to a set,
  // so it skips any tent already visited and cannot carry the second visit.
  describe("logTentVisit same-day revisits", () => {
    const sequenceDate = "2024-09-28";
    const rejectDate = "2024-09-29";
    const survivesSaveDate = "2024-09-30";
    const deselectDate = "2024-10-01";
    const readOrderDate = "2024-10-02";
    const probeDates = [
      sequenceDate,
      rejectDate,
      survivesSaveDate,
      deselectDate,
      readOrderDate,
    ];

    let secondTent: { id: string; name: string };

    beforeAll(async () => {
      const { data: tent, error } = await supabaseAdmin
        .from("tents")
        .insert({ id: randomUUID(), name: `Second Test Tent ${Date.now()}`, category: "large" })
        .select()
        .single();

      if (error || !tent) {
        throw new Error(`Failed to create second test tent: ${error?.message || "Unknown error"}`);
      }

      secondTent = { id: tent.id, name: tent.name };

      await supabaseAdmin
        .from("festival_tents")
        .insert({ festival_id: testFestival.id, tent_id: secondTent.id });
    });

    // Cleanup by probe date rather than by tracked id, for the same reason the
    // block above does: the outer beforeEach clears the id arrays between tests.
    afterAll(async () => {
      for (const date of probeDates) {
        await supabaseAdmin
          .from("tent_visits")
          .delete()
          .eq("user_id", testUser.id)
          .gte("visit_date", `${date}T00:00:00Z`)
          .lt("visit_date", nextDay(date));
        await supabaseAdmin
          .from("attendances")
          .delete()
          .eq("user_id", testUser.id)
          .eq("festival_id", testFestival.id)
          .eq("date", date);
      }

      await supabaseAdmin.from("festival_tents").delete().eq("tent_id", secondTent.id);
      await supabaseAdmin.from("tents").delete().eq("id", secondTent.id);
    });

    function nextDay(date: string): string {
      return new Date(Date.parse(`${date}T00:00:00Z`) + 24 * 60 * 60 * 1000).toISOString();
    }

    function repoFor(token: string): SupabaseAttendanceRepository {
      return new SupabaseAttendanceRepository(createTestSupabaseWithAuth(token));
    }

    async function visitsOnDate(
      date: string,
    ): Promise<{ tent_id: string; visit_date: string | null }[]> {
      const { data } = await supabaseAdmin
        .from("tent_visits")
        .select("tent_id, visit_date")
        .eq("user_id", testUser.id)
        .eq("festival_id", testFestival.id)
        .gte("visit_date", `${date}T00:00:00Z`)
        .lt("visit_date", nextDay(date))
        .order("visit_date", { ascending: true });
      return data ?? [];
    }

    it("records a second visit to the same tent after visiting another", async () => {
      const repo = repoFor(testUser.token);

      await repo.logTentVisit(testUser.id, {
        festivalId: testFestival.id,
        tentId: testTent.id,
        visitedAt: `${sequenceDate}T10:00:00.000Z`,
      });
      await repo.logTentVisit(testUser.id, {
        festivalId: testFestival.id,
        tentId: secondTent.id,
        visitedAt: `${sequenceDate}T15:00:00.000Z`,
      });
      await repo.logTentVisit(testUser.id, {
        festivalId: testFestival.id,
        tentId: testTent.id,
        visitedAt: `${sequenceDate}T20:00:00.000Z`,
      });

      const visits = await visitsOnDate(sequenceDate);
      expect(visits.map((visit) => visit.tent_id)).toEqual([
        testTent.id,
        secondTent.id,
        testTent.id,
      ]);
      expect(visits.map((visit) => new Date(visit.visit_date!).toISOString())).toEqual([
        `${sequenceDate}T10:00:00.000Z`,
        `${sequenceDate}T15:00:00.000Z`,
        `${sequenceDate}T20:00:00.000Z`,
      ]);
    });

    // Order is meaning now that a day is a sequence rather than a set: the web
    // visited-tents dialog renders getByDate's tentVisits in the order it
    // receives them, so the query has to sort. Rows are inserted directly, out of
    // time order, because logTentVisit's guard forbids the "A at 20:00 then A at
    // 10:00" sequence that would otherwise produce them.
    it("returns a day's visits in time order, whatever order they were stored in", async () => {
      const { error: attendanceError } = await supabaseAdmin.from("attendances").insert({
        user_id: testUser.id,
        festival_id: testFestival.id,
        date: readOrderDate,
      });
      expect(attendanceError).toBeNull();

      const { error: visitsError } = await supabaseAdmin.from("tent_visits").insert([
        {
          id: randomUUID(),
          user_id: testUser.id,
          festival_id: testFestival.id,
          tent_id: testTent.id,
          visit_date: `${readOrderDate}T20:00:00.000Z`,
        },
        {
          id: randomUUID(),
          user_id: testUser.id,
          festival_id: testFestival.id,
          tent_id: secondTent.id,
          visit_date: `${readOrderDate}T15:00:00.000Z`,
        },
        {
          id: randomUUID(),
          user_id: testUser.id,
          festival_id: testFestival.id,
          tent_id: testTent.id,
          visit_date: `${readOrderDate}T10:00:00.000Z`,
        },
      ]);
      expect(visitsError).toBeNull();

      const attendance = await repoFor(testUser.token).getByDate(
        testUser.id,
        testFestival.id,
        readOrderDate,
      );

      expect(attendance?.tentVisits.map((visit) => visit.visitDate)).toEqual([
        `${readOrderDate}T10:00:00+00:00`,
        `${readOrderDate}T15:00:00+00:00`,
        `${readOrderDate}T20:00:00+00:00`,
      ]);
      // The same day, read as a set for the tent selector: three visits, two tents.
      expect(attendance?.tentIds).toEqual([testTent.id, secondTent.id]);
    });

    // Logging the tent you are standing in is a stray tap, not a revisit, and
    // two adjacent rows for one tent would read as having left and returned.
    it("rejects logging the tent that is already the day's latest visit", async () => {
      const repo = repoFor(testUser.token);

      await repo.logTentVisit(testUser.id, {
        festivalId: testFestival.id,
        tentId: testTent.id,
        visitedAt: `${rejectDate}T10:00:00.000Z`,
      });

      await expect(
        repo.logTentVisit(testUser.id, {
          festivalId: testFestival.id,
          tentId: testTent.id,
          visitedAt: `${rejectDate}T11:00:00.000Z`,
        }),
      ).rejects.toThrow(ErrorCodes.TENT_ALREADY_CURRENT_VISIT);

      expect(await visitsOnDate(rejectDate)).toHaveLength(1);
    });

    // The form's save path must not undo a revisit. It reconciles the day to a
    // set of tents, and both tents are still in that set, so it has nothing to
    // add or remove - the extra visit has to survive untouched.
    it("keeps a revisit when the attendance form saves the same tents afterwards", async () => {
      const repo = repoFor(testUser.token);
      const userSupabase = createTestSupabaseWithAuth(testUser.token);

      await repo.logTentVisit(testUser.id, {
        festivalId: testFestival.id,
        tentId: testTent.id,
        visitedAt: `${survivesSaveDate}T10:00:00.000Z`,
      });
      await repo.logTentVisit(testUser.id, {
        festivalId: testFestival.id,
        tentId: secondTent.id,
        visitedAt: `${survivesSaveDate}T15:00:00.000Z`,
      });
      await repo.logTentVisit(testUser.id, {
        festivalId: testFestival.id,
        tentId: testTent.id,
        visitedAt: `${survivesSaveDate}T20:00:00.000Z`,
      });

      const { data, error } = await userSupabase.rpc("update_personal_attendance_with_tents", {
        p_user_id: testUser.id,
        p_date: `${survivesSaveDate}T22:00:00Z`,
        p_beer_count: 0,
        p_tent_ids: [testTent.id, secondTent.id],
        p_festival_id: testFestival.id,
      });

      expect(error).toBeNull();
      expect(data![0].tents_added).toEqual([]);
      expect(data![0].tents_removed).toEqual([]);

      const visits = await visitsOnDate(survivesSaveDate);
      expect(visits.map((visit) => visit.tent_id)).toEqual([
        testTent.id,
        secondTent.id,
        testTent.id,
      ]);
    });

    // Deselecting a tent still clears the whole day for it, every visit included.
    it("removes every visit to a tent the form deselects", async () => {
      const repo = repoFor(testUser.token);
      const userSupabase = createTestSupabaseWithAuth(testUser.token);

      for (const [tentId, hour] of [
        [testTent.id, "09"],
        [secondTent.id, "12"],
        [testTent.id, "18"],
      ] as const) {
        await repo.logTentVisit(testUser.id, {
          festivalId: testFestival.id,
          tentId,
          visitedAt: `${deselectDate}T${hour}:00:00.000Z`,
        });
      }
      expect(await visitsOnDate(deselectDate)).toHaveLength(3);

      const { data, error } = await userSupabase.rpc("update_personal_attendance_with_tents", {
        p_user_id: testUser.id,
        p_date: `${deselectDate}T23:00:00Z`,
        p_beer_count: 0,
        p_tent_ids: [secondTent.id],
        p_festival_id: testFestival.id,
      });

      expect(error).toBeNull();
      expect(data![0].tents_removed).toEqual([testTent.id]);

      const visits = await visitsOnDate(deselectDate);
      expect(visits.map((visit) => visit.tent_id)).toEqual([secondTent.id]);
    });
  });
});
