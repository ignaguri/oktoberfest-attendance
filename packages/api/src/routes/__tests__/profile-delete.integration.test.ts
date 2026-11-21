import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createLiveFestival,
  createTestUser,
  type TestFestival,
  type TestUser,
} from "../../__tests__/helpers/day-plan-fixtures";
import { deleteTestUsersAndFestivals } from "../../__tests__/helpers/test-cleanup";
import { createTestSupabaseAdmin } from "../../__tests__/helpers/test-supabase";
import { createTestApp } from "../../__tests__/helpers/test-server";
import { authMiddleware } from "../../middleware/auth";
import profileRoutes from "../profile.route";

// Account deletion depends on RLS and FK cascades, which only a real database exercises.
describe("DELETE /profile (Local DB)", () => {
  let admin: SupabaseClient<Database>;
  let user: TestUser;
  let festival: TestFestival;

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    user = await createTestUser("profile-delete");
    festival = await createLiveFestival(admin);

    const { data: group, error: groupError } = await admin
      .from("groups")
      .insert({
        name: `Delete ${user.id.slice(0, 8)}`,
        password: "x",
        created_by: user.id,
        winning_criteria_id: 4,
        festival_id: festival.id,
      })
      .select("id")
      .single();
    if (groupError || !group) {
      throw new Error(`Failed to create group: ${groupError?.message}`);
    }

    const { data: attendance, error: attendanceError } = await admin
      .from("attendances")
      .insert({ user_id: user.id, festival_id: festival.id, date: festival.startDate })
      .select("id")
      .single();
    if (attendanceError || !attendance) {
      throw new Error(`Failed to create attendance: ${attendanceError?.message}`);
    }

    const { data: achievement } = await admin.from("achievements").select("id").limit(1).single();
    if (!achievement) {
      throw new Error("Achievement registry is empty");
    }

    const inserts = await Promise.all([
      admin.from("group_members").insert({ group_id: group.id, user_id: user.id }),
      admin.from("beer_pictures").insert({
        user_id: user.id,
        attendance_id: attendance.id,
        picture_url: `${user.id}/${festival.id}/delete-test.jpg`,
        visibility: "public",
      }),
      admin.from("user_achievements").insert({
        user_id: user.id,
        achievement_id: achievement.id,
        festival_id: festival.id,
      }),
    ]);
    const insertError = inserts.find((result) => result.error)?.error;
    if (insertError) {
      throw new Error(`Failed to seed user data: ${insertError.message}`);
    }
  });

  afterAll(async () => {
    await deleteTestUsersAndFestivals(admin, {
      userIds: [user.id],
      festivalIds: [festival.id],
    });
  });

  it("deletes the auth user and everything that references it", async () => {
    const app = createTestApp();
    app.use("*", authMiddleware);
    app.route("/", profileRoutes);

    const response = await app.request("/profile", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(response.status).toBe(200);

    const { data: authUser } = await admin.auth.admin.getUserById(user.id);
    expect(authUser.user).toBeNull();

    const counts = await Promise.all(
      (["group_members", "beer_pictures", "user_achievements"] as const).map(async (table) => {
        const { count } = await admin
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        return [table, count];
      }),
    );
    const { count: profileCount } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("id", user.id);

    expect(Object.fromEntries(counts)).toEqual({
      group_members: 0,
      beer_pictures: 0,
      user_achievements: 0,
    });
    expect(profileCount).toBe(0);
  });
});
