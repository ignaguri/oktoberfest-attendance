// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test:integration -- client-identification
//
// The unit tests in apps/{web,mobile}/lib/__tests__/api-client.test.ts prove the
// clients SEND X-Client-Platform / X-Client-Version. This proves the other half:
// that the middleware turns them into user_active_days.platform / app_version,
// which is the column the whole change exists to populate. Neither half is
// meaningful alone — the header names have to agree across the boundary, and
// nothing but a real request checks that.
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
} from "../../__tests__/helpers/test-supabase";
import { createTestApp } from "../../__tests__/helpers/test-server";
import { authMiddleware } from "../auth";

const supabaseAdmin = createTestSupabaseAdmin();
const createdUserIds: string[] = [];

/** Signs up a throwaway user and returns their id + access token. */
async function createTestUser() {
  const supabaseAnon = createTestSupabaseAnon();
  const email = `client-id-${randomUUID()}@integration-test.com`;
  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password: "test-password-123!",
  });
  if (error || !data.user || !data.session) {
    throw new Error(
      `Failed to create test user: ${error?.message ?? "unknown error"}`,
    );
  }
  createdUserIds.push(data.user.id);
  return { id: data.user.id, token: data.session.access_token };
}

/** A minimal app behind the real authMiddleware: this test is about the middleware, not any route. */
function createPingApp() {
  const app = createTestApp();
  app.use("*", authMiddleware);
  app.get("/ping", (c) => c.json({ ok: true }));
  return app;
}

/**
 * recordActiveDay is deliberately not awaited by the middleware (it must add
 * zero latency to a request), so the row lands after the response, and a
 * second ping's upsert can still be in flight when its response comes back.
 * Poll rather than sleep a fixed amount, to avoid a flaky test on a slow
 * machine.
 *
 * minRequestCount matters whenever a test pings more than once: the row from
 * ping #1 already satisfies a plain existence check, so a caller asserting on
 * the state after ping #2 would read stale data and could pass whether or not
 * that second upsert ever ran. request_count starts at 1 (column DEFAULT) and
 * the RPC's ON CONFLICT increments it, so it is what actually proves a
 * specific ping was persisted.
 */
async function waitForActiveDayRow(
  userId: string,
  { minRequestCount = 1, timeoutMs = 5000 } = {},
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await supabaseAdmin
      .from("user_active_days")
      .select("platform, app_version, request_count")
      .eq("user_id", userId)
      .maybeSingle();
    if (data && data.request_count >= minRequestCount) {
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `No user_active_days row with request_count >= ${minRequestCount} appeared for ${userId} within ${timeoutMs}ms`,
  );
}

async function ping(token: string, headers: Record<string, string> = {}) {
  const app = createPingApp();
  return await app.request("/ping", {
    headers: { Authorization: `Bearer ${token}`, ...headers },
  });
}

describe("client identification headers reach user_active_days", () => {
  beforeAll(() => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Integration tests need local Supabase env vars; see the file header",
      );
    }
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await supabaseAdmin
        .from("user_active_days")
        .delete()
        .eq("user_id", userId);
      // profiles_id_fkey is ON DELETE NO ACTION and a signup trigger creates the
      // row, so auth.admin.deleteUser 500s while it exists. Dropping the profile
      // first is what makes the delete actually succeed; without it this loop
      // silently leaves a user behind on every run.
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        // Surfaced rather than swallowed: silent cleanup failures are how the
        // local database accumulates hundreds of orphaned test users.
        console.warn(`Failed to delete test user ${userId}: ${error.message}`);
      }
    }
  });

  it("records the platform and version the client sent", async () => {
    const user = await createTestUser();

    const response = await ping(user.token, {
      "X-Client-Platform": "ios",
      "X-Client-Version": "1.7.0",
    });
    expect(response.status).toBe(200);

    const row = await waitForActiveDayRow(user.id);
    expect(row.platform).toBe("ios");
    expect(row.app_version).toBe("1.7.0");
  });

  it("leaves them NULL when the client sends no headers", async () => {
    const user = await createTestUser();

    // This is the state every row was in before this change: the middleware has
    // always read these headers, so a NULL here means the client stayed silent,
    // not that the middleware ignored it.
    const response = await ping(user.token);
    expect(response.status).toBe(200);

    const row = await waitForActiveDayRow(user.id);
    expect(row.platform).toBeNull();
    expect(row.app_version).toBeNull();
  });

  it("does not let a later header-less request erase what was recorded", async () => {
    const user = await createTestUser();

    await ping(user.token, {
      "X-Client-Platform": "android",
      "X-Client-Version": "1.7.0",
    });
    await waitForActiveDayRow(user.id);

    // record_user_active_day upserts with coalesce(excluded.platform, existing),
    // so an older binary that sends nothing must not blank out a row an
    // identified request already populated for that day. minRequestCount: 2
    // is what proves this second, header-less upsert actually ran — without
    // it the assertion below would pass just as well if it never fired at
    // all, since either way platform stays "android".
    await ping(user.token);

    const row = await waitForActiveDayRow(user.id, { minRequestCount: 2 });
    expect(row.platform).toBe("android");
    expect(row.app_version).toBe("1.7.0");
  });

  it("lets the newest identified request win for the day", async () => {
    const user = await createTestUser();

    await ping(user.token, {
      "X-Client-Platform": "ios",
      "X-Client-Version": "1.7.0",
    });
    await waitForActiveDayRow(user.id);

    await ping(user.token, {
      "X-Client-Platform": "web",
      "X-Client-Version": "1.3.0",
    });

    // Documents a real limitation rather than an aspiration: user_active_days is
    // one row per user per day, so someone using phone and web the same day
    // collapses to whichever came last. Read the platform split as approximate.
    const row = await waitForActiveDayRow(user.id, { minRequestCount: 2 });
    expect(row.platform).toBe("web");
    expect(row.app_version).toBe("1.3.0");
  });
});
