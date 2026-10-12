// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test:integration -- live-activity-tokens
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createLiveFestival,
  createTestUser,
  dayFromToday,
  type TestFestival,
  type TestUser,
} from "../../../__tests__/helpers/day-plan-fixtures";
import { deleteTestUsersAndFestivals } from "../../../__tests__/helpers/test-cleanup";
import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";

const admin = createTestSupabaseAdmin();
let owner: TestUser;
let stranger: TestUser;
let festival: TestFestival;

beforeAll(async () => {
  owner = await createTestUser("la-owner");
  stranger = await createTestUser("la-stranger");
  festival = await createLiveFestival(admin);
});

afterAll(async () => {
  await deleteTestUsersAndFestivals(admin, {
    userIds: [owner?.id, stranger?.id].filter(Boolean) as string[],
    festivalIds: festival ? [festival.id] : [],
  });
});

describe("live_activity_tokens RLS", () => {
  it("lets owners write and read their own tokens and hides them from others", async () => {
    const ownerClient = createTestSupabaseWithAuth(owner.token);
    const { error: insertError } = await ownerClient.from("live_activity_tokens").insert({
      user_id: owner.id,
      platform: "ios",
      token: "token-owner",
      apns_environment: "sandbox",
      festival_id: festival.id,
      date: dayFromToday(0),
    });
    expect(insertError).toBeNull();

    const { data: ownRows } = await ownerClient.from("live_activity_tokens").select("token");
    expect(ownRows).toEqual([{ token: "token-owner" }]);

    const strangerClient = createTestSupabaseWithAuth(stranger.token);
    const { data: strangerRows } = await strangerClient.from("live_activity_tokens").select("token");
    expect(strangerRows).toEqual([]);

    const { error: deleteError } = await strangerClient
      .from("live_activity_tokens")
      .delete()
      .eq("token", "token-owner");
    expect(deleteError).toBeNull();
    const { data: stillThere } = await ownerClient.from("live_activity_tokens").select("token");
    expect(stillThere).toEqual([{ token: "token-owner" }]);
  });

  it("rejects writing a row for another user", async () => {
    const strangerClient = createTestSupabaseWithAuth(stranger.token);
    const { error } = await strangerClient.from("live_activity_tokens").insert({
      user_id: owner.id,
      platform: "android",
      token: "token-forged",
      apns_environment: null,
      festival_id: festival.id,
      date: dayFromToday(0),
    });
    expect(error).not.toBeNull();
  });

  it("requires an APNs environment for iOS rows", async () => {
    const ownerClient = createTestSupabaseWithAuth(owner.token);
    const { error } = await ownerClient.from("live_activity_tokens").insert({
      user_id: owner.id,
      platform: "ios",
      token: "token-no-env",
      apns_environment: null,
      festival_id: festival.id,
      date: dayFromToday(0),
    });
    expect(error).not.toBeNull();
  });

  it("is invisible to anon", async () => {
    const { data, error } = await createTestSupabaseAnon().from("live_activity_tokens").select("token");
    expect(data ?? []).toEqual([]);
    expect(error === null || error.code === "42501").toBe(true);
  });
});
