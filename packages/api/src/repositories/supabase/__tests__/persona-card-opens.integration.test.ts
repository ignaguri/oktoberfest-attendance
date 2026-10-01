// Integration test: requires a running local Supabase with the persona_card_opens migration applied.
// Run with: pnpm --filter=@prostcounter/api test:integration persona-card-opens
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
const createdUserIds: string[] = [];

async function createSignedInUser(label: string) {
  const client = createTestSupabaseAnon();
  const { data, error } = await client.auth.signUp({
    email: `persona-${label}-${randomUUID()}@integration-test.com`,
    password: "test-password-123!",
  });
  if (error || !data.user || !data.session) {
    throw new Error(`signUp failed or returned no session: ${error?.message}`);
  }
  createdUserIds.push(data.user.id);
  return { id: data.user.id, client };
}

describe("persona_card_opens RLS", () => {
  beforeAll(() => {
    admin = createTestSupabaseAdmin();
  });

  afterAll(async () => {
    await deleteTestUsersAndFestivals(admin, { userIds: createdUserIds, festivalIds: [] });
  });

  it("lets a user record and read their own opens, idempotently", async () => {
    const alice = await createSignedInUser("alice");
    const row = { user_id: alice.id, persona_id: "nachteule" };

    const first = await alice.client
      .from("persona_card_opens")
      .upsert(row, { onConflict: "user_id,persona_id", ignoreDuplicates: true });
    expect(first.error).toBeNull();
    const second = await alice.client
      .from("persona_card_opens")
      .upsert(row, { onConflict: "user_id,persona_id", ignoreDuplicates: true });
    expect(second.error).toBeNull();

    const { data, error } = await alice.client.from("persona_card_opens").select("persona_id");
    expect(error).toBeNull();
    expect(data).toEqual([{ persona_id: "nachteule" }]);
  });

  it("hides other users' opens and rejects writing them", async () => {
    const alice = await createSignedInUser("alice2");
    const bob = await createSignedInUser("bob");
    await admin.from("persona_card_opens").insert({ user_id: alice.id, persona_id: "stammgast" });

    const { data } = await bob.client.from("persona_card_opens").select("persona_id");
    expect(data).toEqual([]);

    const { error } = await bob.client
      .from("persona_card_opens")
      .insert({ user_id: alice.id, persona_id: "geniesser" });
    expect(error).not.toBeNull();
  });
});
