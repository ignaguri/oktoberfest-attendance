import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deletes integration-test users and festivals, and throws if any of it fails.
 *
 * Most tables cascade off users and festivals, but a few plain FKs (no ON
 * DELETE) block the parent delete: group_members and location_sessions block
 * a user, and groups, attendances and tent_visits block a festival (with
 * beer_pictures blocking its attendances). Supabase returns those failures
 * instead of throwing, so an unchecked delete quietly leaves the row behind,
 * and every later run adds more.
 *
 * Users go first because deleting them cascades away their attendances, which
 * would otherwise still block the festival.
 */
export async function deleteTestUsersAndFestivals(
  admin: SupabaseClient<Database>,
  { userIds = [], festivalIds = [] }: { userIds?: string[]; festivalIds?: string[] },
): Promise<void> {
  const errors: string[] = [];
  const check = (step: string, error: { message: string } | null) => {
    if (error) {
      errors.push(`${step}: ${error.message}`);
    }
  };

  if (userIds.length > 0) {
    check(
      "group_members by user",
      (await admin.from("group_members").delete().in("user_id", userIds)).error,
    );
    check(
      "location_sessions by user",
      (await admin.from("location_sessions").delete().in("user_id", userIds)).error,
    );
    for (const userId of userIds) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      // Already gone (a test deleted it inline) is the outcome we want
      if (error && error.status !== 404) {
        check(`auth user ${userId}`, error);
      }
    }
  }

  if (festivalIds.length > 0) {
    const { data: groups, error: groupsError } = await admin
      .from("groups")
      .select("id")
      .in("festival_id", festivalIds);
    check("select groups", groupsError);
    const groupIds = (groups ?? []).map((group) => group.id);
    if (groupIds.length > 0) {
      check(
        "group_members by group",
        (await admin.from("group_members").delete().in("group_id", groupIds)).error,
      );
      check("groups", (await admin.from("groups").delete().in("id", groupIds)).error);
    }

    const { data: attendances, error: attendancesError } = await admin
      .from("attendances")
      .select("id")
      .in("festival_id", festivalIds);
    check("select attendances", attendancesError);
    const attendanceIds = (attendances ?? []).map((attendance) => attendance.id);
    if (attendanceIds.length > 0) {
      check(
        "beer_pictures",
        (await admin.from("beer_pictures").delete().in("attendance_id", attendanceIds)).error,
      );
    }

    check(
      "tent_visits",
      (await admin.from("tent_visits").delete().in("festival_id", festivalIds)).error,
    );
    check(
      "attendances",
      (await admin.from("attendances").delete().in("festival_id", festivalIds)).error,
    );
    check("festivals", (await admin.from("festivals").delete().in("id", festivalIds)).error);
  }

  if (errors.length > 0) {
    throw new Error(`Test cleanup left rows behind:\n${errors.join("\n")}`);
  }
}
