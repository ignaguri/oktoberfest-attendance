import type { Database } from "@prostcounter/db";
import { formatDateForDatabase } from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

import { deleteTestUsersAndFestivals } from "./test-cleanup";
import { createTestSupabaseAnon } from "./test-supabase";

/** Festival timezone every day-plan fixture uses. */
export const DAY_PLAN_TEST_TIMEZONE = "Europe/Berlin";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

export interface TestFestival {
  id: string;
  startDate: string;
  endDate: string;
}

export interface TestTent {
  id: string;
  name: string;
}

/** YYYY-MM-DD in the fixture timezone, `offset` days from now. */
export function dayFromToday(offset: number): string {
  return formatDateForDatabase(new Date(Date.now() + offset * DAY_MS), DAY_PLAN_TEST_TIMEZONE);
}

export async function createTestUser(label: string): Promise<TestUser> {
  const anon = createTestSupabaseAnon();
  const email = `${label}-${Date.now()}-${randomUUID().slice(0, 8)}@integration-test.com`;
  const { data, error } = await anon.auth.signUp({ email, password: "test-password-123!" });

  if (error || !data.user || !data.session) {
    throw new Error(`Failed to create ${label}: ${error?.message ?? "no session"}`);
  }

  return { id: data.user.id, email, token: data.session.access_token };
}

/** A festival running from yesterday to ten days out, so "today" is always plannable. */
export async function createLiveFestival(admin: SupabaseClient<Database>): Promise<TestFestival> {
  const startDate = dayFromToday(-1);
  const endDate = dayFromToday(10);
  const suffix = randomUUID().slice(0, 12);

  const { data, error } = await admin
    .from("festivals")
    .insert({
      name: `Day Plans Test Festival ${suffix}`,
      short_name: `dp-${suffix}`,
      festival_type: "oktoberfest",
      start_date: startDate,
      end_date: endDate,
      beer_cost: 16.2,
      location: "Test Location",
      timezone: DAY_PLAN_TEST_TIMEZONE,
      is_active: false,
      status: "upcoming",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create festival: ${error?.message ?? "no data"}`);
  }

  return { id: data.id, startDate, endDate };
}

export async function createTestTent(admin: SupabaseClient<Database>): Promise<TestTent> {
  const tent = { id: randomUUID(), name: `Day Plans Tent ${randomUUID().slice(0, 8)}` };
  const { error } = await admin.from("tents").insert({ ...tent, category: "large" });

  if (error) {
    throw new Error(`Failed to create tent: ${error.message}`);
  }

  return tent;
}

export async function makeFriends(
  admin: SupabaseClient<Database>,
  requesterId: string,
  addresseeId: string,
): Promise<void> {
  const { error } = await admin
    .from("friendships")
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: "accepted" });

  if (error) {
    throw new Error(`Failed to create friendship: ${error.message}`);
  }
}

export async function createSharedGroup(
  admin: SupabaseClient<Database>,
  festivalId: string,
  memberIds: string[],
): Promise<string> {
  const { data: group, error } = await admin
    .from("groups")
    .insert({
      name: `DP Group ${randomUUID().slice(0, 8)}`,
      festival_id: festivalId,
      password: "",
      winning_criteria_id: 2,
      created_by: memberIds[0],
    })
    .select("id")
    .single();

  if (error || !group) {
    throw new Error(`Failed to create group: ${error?.message ?? "no data"}`);
  }

  const { error: membersError } = await admin
    .from("group_members")
    .insert(memberIds.map((userId) => ({ group_id: group.id, user_id: userId })));

  if (membersError) {
    throw new Error(`Failed to add group members: ${membersError.message}`);
  }

  return group.id;
}

export async function cleanupDayPlanFixtures(
  admin: SupabaseClient<Database>,
  {
    festivalIds,
    tentIds,
    userIds,
  }: { festivalIds: string[]; tentIds: string[]; userIds: string[] },
): Promise<void> {
  if (festivalIds.length > 0) {
    await admin.from("day_plan_overlap_notifications").delete().in("festival_id", festivalIds);
    await admin.from("day_plans").delete().in("festival_id", festivalIds);
  }

  if (userIds.length > 0) {
    await admin.from("friendships").delete().in("requester_id", userIds);
  }

  // Also deletes the users: createTestUser signs them up, and nothing else did
  await deleteTestUsersAndFestivals(admin, { userIds, festivalIds });

  // Last, since day plans and visits referencing a tent are gone by now
  if (tentIds.length > 0) {
    await admin.from("tents").delete().in("id", tentIds);
  }
}
