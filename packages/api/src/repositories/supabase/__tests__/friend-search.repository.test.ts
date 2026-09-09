import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { SupabaseFriendRepository } from "../friend.repository";

const ME = "00000000-0000-4000-8000-000000000001";
const REQUESTED = "00000000-0000-4000-8000-000000000002";
const REQUESTER = "00000000-0000-4000-8000-000000000003";
const STRANGER = "00000000-0000-4000-8000-000000000004";
const OUTGOING_FRIENDSHIP = "11111111-1111-4111-8111-111111111111";
const INCOMING_FRIENDSHIP = "22222222-2222-4222-8222-222222222222";

const PROFILES = [
  { id: REQUESTED, username: "requested", full_name: "Requested User", avatar_url: null },
  { id: REQUESTER, username: "requester", full_name: "Requester User", avatar_url: null },
  { id: STRANGER, username: "stranger", full_name: "Stranger User", avatar_url: null },
];

const FRIENDSHIPS = [
  { id: OUTGOING_FRIENDSHIP, requester_id: ME, addressee_id: REQUESTED, status: "pending" },
  { id: INCOMING_FRIENDSHIP, requester_id: REQUESTER, addressee_id: ME, status: "pending" },
];

/**
 * searchUsers runs two queries and joins them in memory, so the fake only has
 * to hand back a row set per table and stay chainable in between.
 */
function createSupabaseStub() {
  const results: Record<string, unknown[]> = {
    profiles: PROFILES,
    friendships: FRIENDSHIPS,
  };

  return {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "neq", "or", "limit", "eq", "in"]) {
        builder[method] = () => builder;
      }
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: results[table] ?? [], error: null }).then(resolve);
      return builder;
    },
  } as unknown as SupabaseClient<Database>;
}

describe("SupabaseFriendRepository.searchUsers", () => {
  it("returns the friendship id alongside an outgoing request", async () => {
    const repo = new SupabaseFriendRepository(createSupabaseStub());

    const results = await repo.searchUsers(ME, "user");
    const requested = results.find((r) => r.id === REQUESTED);

    expect(requested).toMatchObject({
      friendshipStatus: "pending_sent",
      friendshipId: OUTGOING_FRIENDSHIP,
    });
  });

  it("returns the friendship id alongside an incoming request", async () => {
    const repo = new SupabaseFriendRepository(createSupabaseStub());

    const results = await repo.searchUsers(ME, "user");
    const requester = results.find((r) => r.id === REQUESTER);

    expect(requester).toMatchObject({
      friendshipStatus: "pending_received",
      friendshipId: INCOMING_FRIENDSHIP,
    });
  });

  it("returns a null friendship id for someone with no friendship row", async () => {
    const repo = new SupabaseFriendRepository(createSupabaseStub());

    const results = await repo.searchUsers(ME, "user");
    const stranger = results.find((r) => r.id === STRANGER);

    expect(stranger).toMatchObject({
      friendshipStatus: "none",
      friendshipId: null,
    });
  });
});
