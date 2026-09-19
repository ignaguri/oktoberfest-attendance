// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test:integration -- record-active-day-rpc
//
// record_user_active_day is SECURITY DEFINER and granted to authenticated, and
// adding p_push_permission meant DROP FUNCTION + CREATE. That is exactly how the
// auth.uid() guard has been lost before, so these tests call the RPC through a
// signed-in anon client: service_role leaves auth.uid() NULL and would never
// exercise the guard.
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../__tests__/helpers/test-supabase";

const supabaseAdmin = createTestSupabaseAdmin();
const createdUserIds: string[] = [];

async function createTestUser() {
  const supabaseAnon = createTestSupabaseAnon();
  const email = `active-day-rpc-${randomUUID()}@integration-test.com`;
  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password: "test-password-123!",
  });
  if (error || !data.user || !data.session) {
    throw new Error(`Failed to create test user: ${error?.message ?? "unknown error"}`);
  }
  createdUserIds.push(data.user.id);
  return {
    id: data.user.id,
    client: createTestSupabaseWithAuth(data.session.access_token),
  };
}

async function readPushPermission(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_active_days")
    .select("push_permission")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

describe("record_user_active_day push_permission", () => {
  beforeAll(() => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Integration tests need local Supabase env vars; see the file header");
    }
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await supabaseAdmin.from("user_active_days").delete().eq("user_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        console.warn(`Failed to delete test user ${userId}: ${error.message}`);
      }
    }
  });

  it("stores the permission the caller reports for themselves", async () => {
    const user = await createTestUser();

    const { error } = await user.client.rpc("record_user_active_day", {
      p_user_id: user.id,
      p_push_permission: "denied",
    });

    expect(error).toBeNull();
    expect(await readPushPermission(user.id)).toEqual({ push_permission: "denied" });
  });

  it("keeps the day's value when a later call sends none, and lets a new value win", async () => {
    const user = await createTestUser();

    await user.client.rpc("record_user_active_day", {
      p_user_id: user.id,
      p_push_permission: "undetermined",
    });
    await user.client.rpc("record_user_active_day", { p_user_id: user.id });
    expect(await readPushPermission(user.id)).toEqual({ push_permission: "undetermined" });

    await user.client.rpc("record_user_active_day", {
      p_user_id: user.id,
      p_push_permission: "granted",
    });
    expect(await readPushPermission(user.id)).toEqual({ push_permission: "granted" });
  });

  it("refuses to write another user's row", async () => {
    const attacker = await createTestUser();
    const victim = await createTestUser();

    const { error } = await attacker.client.rpc("record_user_active_day", {
      p_user_id: victim.id,
      p_push_permission: "granted",
    });

    expect(error?.message).toContain("user mismatch");
    expect(await readPushPermission(victim.id)).toBeNull();
  });

  it("rejects values outside the allowed set", async () => {
    const user = await createTestUser();

    const { error } = await user.client.rpc("record_user_active_day", {
      p_user_id: user.id,
      p_push_permission: "maybe",
    });

    expect(error).not.toBeNull();
    expect(await readPushPermission(user.id)).toBeNull();
  });
});
