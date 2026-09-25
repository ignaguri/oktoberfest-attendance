import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupDayPlanFixtures,
  createLiveFestival,
  createSharedGroup,
  createTestUser,
  dayFromToday,
  makeFriends,
  type TestFestival,
  type TestUser,
} from "../../../__tests__/helpers/day-plan-fixtures";
import {
  createTestSupabaseAdmin,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";

describe("activity_feed photo items (Local DB)", () => {
  let admin: SupabaseClient<Database>;
  let uploader: TestUser;
  let groupMate: TestUser;
  let friend: TestUser;
  let festival: TestFestival;
  let groupId: string;
  let pictureId: string;

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    uploader = await createTestUser("feed-photo-uploader");
    groupMate = await createTestUser("feed-photo-mate");
    friend = await createTestUser("feed-photo-friend");
    festival = await createLiveFestival(admin);
    groupId = await createSharedGroup(admin, festival.id, [uploader.id, groupMate.id]);
    await makeFriends(admin, uploader.id, friend.id);

    const { data: attendance, error: attendanceError } = await admin
      .from("attendances")
      .insert({ user_id: uploader.id, festival_id: festival.id, date: dayFromToday(0) })
      .select("id")
      .single();
    expect(attendanceError).toBeNull();

    const { data: picture, error: pictureError } = await admin
      .from("beer_pictures")
      .insert({
        user_id: uploader.id,
        attendance_id: attendance!.id,
        picture_url: "test/feed-photo.jpg",
        visibility: "public",
      })
      .select("id")
      .single();
    expect(pictureError).toBeNull();
    pictureId = picture!.id;
  });

  afterAll(async () => {
    await cleanupDayPlanFixtures(admin, {
      festivalIds: festival ? [festival.id] : [],
      tentIds: [],
      userIds: [uploader, groupMate, friend].filter(Boolean).map((user) => user.id),
    });
  });

  async function photoSeenBy(user: TestUser) {
    const { data, error } = await createTestSupabaseWithAuth(user.token)
      .from("activity_feed")
      .select("activity_data")
      .eq("festival_id", festival.id)
      .eq("activity_type", "photo_upload");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    return data![0].activity_data as Record<string, unknown>;
  }

  it("links a group mate's photo to the picture and the shared group", async () => {
    expect(await photoSeenBy(groupMate)).toMatchObject({
      picture_id: pictureId,
      shared_group_id: groupId,
    });
  });

  it("has no shared group for a friend outside the uploader's groups", async () => {
    expect(await photoSeenBy(friend)).toMatchObject({
      picture_id: pictureId,
      shared_group_id: null,
    });
  });
});
