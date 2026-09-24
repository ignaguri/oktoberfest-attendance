// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test:integration -- feedback-rls
import { randomUUID } from "crypto";
import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";

// Created in beforeAll: setup.ts loads the env vars inside a beforeAll hook.
let admin: SupabaseClient<Database>;
const createdUserIds: string[] = [];
let festivalId: string;

async function createSignedInUser(label: string) {
  const anon = createTestSupabaseAnon();
  const email = `feedback-rls-${label}-${randomUUID()}@integration-test.com`;
  const password = "test-password-123!";
  const { data, error } = await anon.auth.signUp({ email, password });
  if (error || !data.user) {
    throw new Error(`signUp failed: ${error?.message ?? "unknown error"}`);
  }
  createdUserIds.push(data.user.id);
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signIn.session) {
    throw new Error(`signIn failed: ${signInError?.message ?? "no session"}`);
  }
  return { id: data.user.id, client: createTestSupabaseWithAuth(signIn.session.access_token) };
}

describe("feedback RLS", () => {
  let alice: Awaited<ReturnType<typeof createSignedInUser>>;
  let bob: Awaited<ReturnType<typeof createSignedInUser>>;

  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    const suffix = randomUUID();
    const { data: festival, error } = await admin
      .from("festivals")
      .insert({
        name: `Feedback RLS Test ${suffix}`,
        short_name: `feedback-rls-${suffix}`.slice(0, 40),
        festival_type: "oktoberfest",
        start_date: "2026-09-19",
        end_date: "2026-10-04",
        beer_cost: 15.8,
        location: "Test Location",
        timezone: "Europe/Berlin",
        is_active: false,
        status: "ended",
      })
      .select()
      .single();
    if (error || !festival) {
      throw new Error(`festival insert failed: ${error?.message}`);
    }
    festivalId = festival.id;
    alice = await createSignedInUser("alice");
    bob = await createSignedInUser("bob");
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId);
    }
    if (festivalId) {
      await admin.from("festivals").delete().eq("id", festivalId);
    }
  });

  it("lets a user insert and read back their own feedback", async () => {
    const id = randomUUID();
    const { error } = await alice.client
      .from("feedback")
      .insert({ id, user_id: alice.id, kind: "bug", message: "It crashed" });
    expect(error).toBeNull();

    const { data } = await alice.client.from("feedback").select("id").eq("id", id);
    expect(data).toEqual([{ id }]);
  });

  it("rejects feedback inserted for another user", async () => {
    const { error } = await alice.client
      .from("feedback")
      .insert({ id: randomUUID(), user_id: bob.id, kind: "idea", message: "Spoofed" });
    expect(error?.code).toBe("42501");
  });

  it("hides other users' feedback", async () => {
    const id = randomUUID();
    await bob.client.from("feedback").insert({ id, user_id: bob.id, kind: "idea", message: "Mine" });

    const { data } = await alice.client.from("feedback").select("id").eq("id", id);
    expect(data).toEqual([]);
  });

  it("rejects anonymous inserts", async () => {
    const { error } = await createTestSupabaseAnon()
      .from("feedback")
      .insert({ id: randomUUID(), user_id: alice.id, kind: "bug", message: "Anon" });
    expect(error).not.toBeNull();
  });

  it("enforces a rating on day feedback", async () => {
    const { error } = await alice.client.from("feedback").insert({
      id: randomUUID(),
      user_id: alice.id,
      kind: "day",
      festival_id: festivalId,
      day: "2026-09-20",
    });
    expect(error?.code).toBe("23514");
  });

  it("allows one day rating per user, festival and day", async () => {
    const row = {
      user_id: alice.id,
      kind: "day",
      rating: 4,
      festival_id: festivalId,
      day: "2026-09-21",
    };
    const first = await alice.client.from("feedback").insert({ id: randomUUID(), ...row });
    expect(first.error).toBeNull();
    const second = await alice.client.from("feedback").insert({ id: randomUUID(), ...row });
    expect(second.error?.code).toBe("23505");
  });

  it("keeps one prompt row per day and lets the user read only their own", async () => {
    const prompt = { user_id: alice.id, festival_id: festivalId, day: "2026-09-22", outcome: "dismissed" };
    const first = await alice.client
      .from("feedback_prompts")
      .upsert(prompt, { onConflict: "user_id,festival_id,day", ignoreDuplicates: true });
    expect(first.error).toBeNull();
    const second = await alice.client
      .from("feedback_prompts")
      .upsert({ ...prompt, outcome: "answered" }, { onConflict: "user_id,festival_id,day", ignoreDuplicates: true });
    expect(second.error).toBeNull();

    const own = await alice.client.from("feedback_prompts").select("outcome").eq("day", "2026-09-22");
    expect(own.data).toEqual([{ outcome: "dismissed" }]);

    const others = await bob.client.from("feedback_prompts").select("outcome").eq("user_id", alice.id);
    expect(others.data).toEqual([]);
  });
});
