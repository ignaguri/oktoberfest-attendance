// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test:integration -- analytics-events
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";

const admin = createTestSupabaseAdmin();
let userId: string;
let userToken: string;

function events(count: number) {
  return Array.from({ length: count }, () => ({
    name: "screen_viewed",
    props: { screen: "/home" },
    occurred_at: new Date().toISOString(),
    session_id: randomUUID(),
  }));
}

describe("analytics_record_events", () => {
  beforeAll(async () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Integration tests need local Supabase env vars; see the file header");
    }
    const { data, error } = await createTestSupabaseAnon().auth.signUp({
      email: `events-${randomUUID().slice(0, 8)}@integration-test.com`,
      password: "test-password-123!",
    });
    if (error || !data.user || !data.session) {
      throw new Error(`Failed to create user: ${error?.message ?? "no session"}`);
    }
    userId = data.user.id;
    userToken = data.session.access_token;
  });

  afterAll(async () => {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("inserts every event and returns the count", async () => {
    const { data, error } = await admin.rpc("analytics_record_events", {
      p_user_id: userId,
      p_events: events(3),
      p_platform: "ios",
      p_app_version: "9.9.9",
    });
    expect(error).toBeNull();
    expect(data).toBe(3);
  });

  it("accepts a call without platform or version", async () => {
    const { data, error } = await admin.rpc("analytics_record_events", {
      p_user_id: userId,
      p_events: events(1),
    });
    expect(error).toBeNull();
    expect(data).toBe(1);
  });

  it("denies the function to signed-in users and anon", async () => {
    const args = { p_user_id: userId, p_events: events(1) };
    const results = await Promise.all([
      createTestSupabaseWithAuth(userToken).rpc("analytics_record_events", args),
      createTestSupabaseAnon().rpc("analytics_record_events", args),
    ]);
    for (const result of results) {
      expect(result.error?.code).toBe("42501");
    }
  });
});
