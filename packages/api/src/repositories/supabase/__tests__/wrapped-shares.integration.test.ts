// Integration test: requires a running local Supabase with migrations applied.
// Run with: pnpm --filter=@prostcounter/api test:integration wrapped-shares
import { randomUUID } from "crypto";
import type { Database } from "@prostcounter/db";
import { buildShareCards } from "@prostcounter/shared/wrapped";
import { makeWrapped } from "@prostcounter/shared/wrapped/testing";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deleteTestUsersAndFestivals } from "../../../__tests__/helpers/test-cleanup";
import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";
import { SupabaseWrappedShareRepository } from "../wrapped-share.repository";

let admin: SupabaseClient<Database>;
let festivalId: string;
const users: { id: string; token: string }[] = [];
const card = buildShareCards(makeWrapped(), null)[0];

async function signUp(suffix: string) {
  const { data, error } = await createTestSupabaseAnon().auth.signUp({
    email: `wrapped-shares-${suffix}@integration-test.com`,
    password: "test-password-123!",
  });
  if (error || !data.user || !data.session) {
    throw new Error(
      `signUp failed (is email confirmation off locally?): ${error?.message}`,
    );
  }
  return { id: data.user.id, token: data.session.access_token };
}

describe("wrapped_shares", () => {
  beforeAll(async () => {
    admin = createTestSupabaseAdmin();
    const suffix = randomUUID();
    const { data: festival, error } = await admin
      .from("festivals")
      .insert({
        name: `Wrapped Shares ${suffix}`,
        short_name: `wrapped-shares-${suffix}`.slice(0, 40),
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
    if (error || !festival) {
      throw new Error(`festival insert failed: ${error?.message}`);
    }
    festivalId = festival.id;
    users.push(await signUp(`a-${suffix}`), await signUp(`b-${suffix}`));
  });

  afterAll(async () => {
    await deleteTestUsersAndFestivals(admin, {
      userIds: users.map((user) => user.id),
      festivalIds: [festivalId].filter(Boolean),
    });
  });

  it("creates a link, reuses it, and hides it from other users", async () => {
    const [owner, other] = users;
    const repo = new SupabaseWrappedShareRepository(
      createTestSupabaseWithAuth(owner.token),
    );
    const first = await repo.upsertLive(owner.id, festivalId, "numbers", card);
    const second = await repo.upsertLive(owner.id, festivalId, "numbers", card);
    expect(first).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(second).toBe(first);
    expect(await repo.listLive(owner.id, festivalId)).toEqual([
      { token: first, kind: "numbers" },
    ]);

    const otherRepo = new SupabaseWrappedShareRepository(
      createTestSupabaseWithAuth(other.token),
    );
    expect(await otherRepo.listLive(owner.id, festivalId)).toEqual([]);
    expect(await otherRepo.revoke(other.id, first)).toBe(false);
  });

  it("serves a live link to anon and stops after revoke", async () => {
    const [owner] = users;
    const repo = new SupabaseWrappedShareRepository(
      createTestSupabaseWithAuth(owner.token),
    );
    const token = await repo.upsertLive(owner.id, festivalId, "persona", card);
    const publicRepo = new SupabaseWrappedShareRepository(
      createTestSupabaseAnon(),
    );
    expect(await publicRepo.getPublic(token)).toMatchObject({
      kind: "persona",
      festivalName: expect.stringContaining("Wrapped Shares"),
    });

    expect(await repo.revoke(owner.id, token)).toBe(true);
    expect(await publicRepo.getPublic(token)).toBeNull();
    expect(await repo.revoke(owner.id, token)).toBe(false);

    const fresh = await repo.upsertLive(owner.id, festivalId, "persona", card);
    expect(fresh).not.toBe(token);
  });

  it("keeps anon out of the table itself", async () => {
    const { data } = await createTestSupabaseAnon()
      .from("wrapped_shares")
      .select("token");
    expect(data ?? []).toEqual([]);
  });

  it("rejects a second live link and a photos link at the database", async () => {
    const [owner] = users;
    const client = createTestSupabaseWithAuth(owner.token);
    await new SupabaseWrappedShareRepository(client).upsertLive(
      owner.id,
      festivalId,
      "rhythm",
      card,
    );
    const duplicate = await client.from("wrapped_shares").insert({
      user_id: owner.id,
      festival_id: festivalId,
      card_kind: "rhythm",
      card_data: {},
    });
    expect(duplicate.error?.code).toBe("23505");
    const photos = await client.from("wrapped_shares").insert({
      user_id: owner.id,
      festival_id: festivalId,
      card_kind: "photos",
      card_data: {},
    });
    expect(photos.error?.code).toBe("23514");
  });

  it("reuses the live link when two inserts race", async () => {
    const [owner] = users;
    const repo = new SupabaseWrappedShareRepository(
      createTestSupabaseWithAuth(owner.token),
    );
    const [a, b] = await Promise.all([
      repo.upsertLive(owner.id, festivalId, "city", card),
      repo.upsertLive(owner.id, festivalId, "city", card),
    ]);
    expect(a).toBe(b);
  });
});
