// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test:integration -- anon-access
import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";

import { createLiveFestival, createTestUser } from "../../../__tests__/helpers/day-plan-fixtures";
import { deleteTestUsersAndFestivals } from "../../../__tests__/helpers/test-cleanup";
import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";

const PERMISSION_DENIED = "42501";
const createdUserIds: string[] = [];
const createdFestivalIds: string[] = [];

const FRIEND_RPCS = [
  ["send_friend_request", { p_requester_id: randomUUID(), p_addressee_id: randomUUID() }],
  ["accept_friend_request", { p_friendship_id: randomUUID(), p_user_id: randomUUID() }],
  ["decline_friend_request", { p_friendship_id: randomUUID(), p_user_id: randomUUID() }],
] as const;

afterAll(async () => {
  await deleteTestUsersAndFestivals(createTestSupabaseAdmin(), {
    userIds: createdUserIds,
    festivalIds: createdFestivalIds,
  });
});

// Dropping and recreating a function or view resets its grants to defaults,
// which include anon, so these pin the friend-request and stats-view fixes.
describe("anon access to definer functions and stats views", () => {
  it.each(FRIEND_RPCS)("anon cannot call %s", async (fn, args) => {
    const { error } = await createTestSupabaseAnon().rpc(fn, args);

    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  // service_role has no auth.uid(), the case the old `!=` guard let through
  it.each(FRIEND_RPCS)("%s refuses a caller without a session", async (fn, args) => {
    const { data, error } = await createTestSupabaseAdmin().rpc(fn, args);

    expect(error).toBeNull();
    expect(data).toMatchObject({ success: false, error_code: "FORBIDDEN" });
  });

  it.each(["user_festival_stats", "user_festival_spending_stats"] as const)(
    "anon cannot read %s",
    async (view) => {
      const { error } = await createTestSupabaseAnon().from(view).select("user_id").limit(1);

      expect(error?.code).toBe(PERMISSION_DENIED);
    },
  );

  it.each(["user_festival_stats", "user_festival_spending_stats"] as const)(
    "a stranger cannot read another user's row in %s",
    async (view) => {
      const admin = createTestSupabaseAdmin();
      const owner = await createTestUser("anon-access-owner");
      const stranger = await createTestUser("anon-access-stranger");
      createdUserIds.push(owner.id, stranger.id);
      const festival = await createLiveFestival(admin);
      createdFestivalIds.push(festival.id);
      const { error: insertError } = await admin
        .from("attendances")
        .insert({ user_id: owner.id, festival_id: festival.id, date: festival.startDate });
      expect(insertError).toBeNull();

      const asAdmin = await admin.from(view).select("user_id").eq("user_id", owner.id);
      const asStranger = await createTestSupabaseWithAuth(stranger.token)
        .from(view)
        .select("user_id")
        .eq("user_id", owner.id);

      expect(asAdmin.data).toHaveLength(1);
      expect(asStranger.error).toBeNull();
      expect(asStranger.data).toEqual([]);
    },
  );
});
