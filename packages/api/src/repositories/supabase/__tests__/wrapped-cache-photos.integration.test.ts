// Integration test: requires a running local Supabase with migrations applied.
// Run with: pnpm --filter=@prostcounter/api test:integration wrapped-cache-photos
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
let userId: string;
let festivalId: string;
let attendanceId: string;

async function cacheRowCount(): Promise<number> {
  const { count, error } = await admin
    .from("wrapped_data_cache")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("festival_id", festivalId);
  if (error) {
    throw new Error(`cache count failed: ${error.message}`);
  }
  return count ?? 0;
}

async function seedCache() {
  const { error } = await admin
    .from("wrapped_data_cache")
    .insert({ user_id: userId, festival_id: festivalId, wrapped_data: {} });
  if (error) {
    throw new Error(`cache insert failed: ${error.message}`);
  }
}

describe("Wrapped cache and photos", () => {
  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    const suffix = randomUUID();
    const { data: festival, error: festivalError } = await admin
      .from("festivals")
      .insert({
        name: `Wrapped Photos ${suffix}`,
        short_name: `wrapped-photos-${suffix}`.slice(0, 40),
        festival_type: "oktoberfest",
        start_date: "2026-09-19",
        end_date: "2026-10-04",
        beer_cost: 15.8,
        location: "Test Location",
        timezone: "Europe/Berlin",
        is_active: false,
        status: "ended",
      })
      .select("id")
      .single();
    if (festivalError || !festival) {
      throw new Error(`festival insert failed: ${festivalError?.message}`);
    }
    festivalId = festival.id;

    const { data: signUp, error: signUpError } = await createTestSupabaseAnon().auth.signUp({
      email: `wrapped-photos-${suffix}@integration-test.com`,
      password: "test-password-123!",
    });
    if (signUpError || !signUp.user) {
      throw new Error(`signUp failed: ${signUpError?.message}`);
    }
    userId = signUp.user.id;

    const { data: attendance, error: attendanceError } = await admin
      .from("attendances")
      .insert({ user_id: userId, festival_id: festivalId, date: "2026-09-20" })
      .select("id")
      .single();
    if (attendanceError || !attendance) {
      throw new Error(`attendance insert failed: ${attendanceError?.message}`);
    }
    attendanceId = attendance.id;
  });

  afterAll(async () => {
    await deleteTestUsersAndFestivals(admin, {
      userIds: [userId].filter(Boolean),
      festivalIds: [festivalId].filter(Boolean),
    });
  });

  it("drops the cached Wrapped when a photo is added", async () => {
    await seedCache();
    const { error } = await admin
      .from("beer_pictures")
      .insert({ user_id: userId, attendance_id: attendanceId, picture_url: "added.jpg" });
    expect(error).toBeNull();
    expect(await cacheRowCount()).toBe(0);
  });

  it("drops the cached Wrapped when a photo is deleted", async () => {
    await seedCache();
    const { error } = await admin.from("beer_pictures").delete().eq("user_id", userId);
    expect(error).toBeNull();
    expect(await cacheRowCount()).toBe(0);
  });

  // Reactions and comments share the trigger function; a tag needs no group to set up.
  it("drops the cached Wrapped when a photo is tagged or untagged", async () => {
    const { data: picture, error } = await admin
      .from("beer_pictures")
      .insert({ user_id: userId, attendance_id: attendanceId, picture_url: "to-tag.jpg" })
      .select("id")
      .single();
    if (error || !picture) {
      throw new Error(`picture insert failed: ${error?.message}`);
    }

    await seedCache();
    expect((await admin.from("photo_tags").insert({ photo_id: picture.id, tagged_user_id: userId })).error).toBeNull();
    expect(await cacheRowCount()).toBe(0);

    await seedCache();
    expect((await admin.from("photo_tags").delete().eq("photo_id", picture.id)).error).toBeNull();
    expect(await cacheRowCount()).toBe(0);

    await admin.from("beer_pictures").delete().eq("id", picture.id);
  });

  it("scores each photo by engagement, a tag counting double", async () => {
    const { data: pictures, error } = await admin
      .from("beer_pictures")
      .insert([
        { user_id: userId, attendance_id: attendanceId, picture_url: "tagged.jpg" },
        { user_id: userId, attendance_id: attendanceId, picture_url: "plain.jpg" },
      ])
      .select("id, picture_url");
    expect(error).toBeNull();
    const tagged = pictures?.find((picture) => picture.picture_url === "tagged.jpg");
    if (!tagged) {
      throw new Error("tagged picture was not inserted");
    }
    const { error: tagError } = await admin.from("photo_tags").insert({ photo_id: tagged.id, tagged_user_id: userId });
    expect(tagError).toBeNull();

    const { data, error: rpcError } = await admin.rpc("get_wrapped_data", {
      p_user_id: userId,
      p_festival_id: festivalId,
    });
    expect(rpcError).toBeNull();
    const scores = Object.fromEntries(
      (data as { social_stats: { pictures: { picture_url: string; social_score: number }[] } }).social_stats.pictures.map(
        (picture) => [picture.picture_url, picture.social_score],
      ),
    );
    expect(scores).toEqual({ "tagged.jpg": 2, "plain.jpg": 0 });
  });
});
