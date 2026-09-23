import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { SupabaseGroupInvitationRepository } from "../group-invitation.repository";

const ME = "00000000-0000-4000-8000-000000000001";
const GROUP = "00000000-0000-4000-8000-0000000000ff";
const INVITED = "00000000-0000-4000-8000-000000000002";
const MEMBER = "00000000-0000-4000-8000-000000000003";
const REQUESTER = "00000000-0000-4000-8000-000000000004";
const STRANGER = "00000000-0000-4000-8000-000000000005";
const DECLINED = "00000000-0000-4000-8000-000000000006";
const LONG_AGO_DECLINED = "00000000-0000-4000-8000-000000000007";
const INVITATION = "11111111-1111-4111-8111-111111111111";

const PROFILES = [
  { id: INVITED, username: "invited", full_name: "Invited User", avatar_url: null },
  { id: MEMBER, username: "member", full_name: "Member User", avatar_url: null },
  { id: REQUESTER, username: "requester", full_name: "Requester User", avatar_url: null },
  { id: STRANGER, username: "stranger", full_name: "Stranger User", avatar_url: null },
  { id: DECLINED, username: "declined", full_name: "Declined User", avatar_url: null },
  { id: LONG_AGO_DECLINED, username: "cooled", full_name: "Cooled Off User", avatar_url: null },
];

const GROUP_MEMBERS = [{ user_id: MEMBER }];
const GROUP_JOIN_REQUESTS = [{ requester_id: REQUESTER }];

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Mirrors what the repository asks for: pending and declined rows both come back */
const GROUP_INVITATIONS = [
  { id: INVITATION, invitee_id: INVITED, status: "pending", responded_at: null },
  // Inside invite_to_group's 7-day cooldown, so still un-invitable
  { id: "22222222-2222-4222-8222-222222222222", invitee_id: DECLINED, status: "declined", responded_at: daysAgo(2) },
  // Past the cooldown, so invitable again
  {
    id: "33333333-3333-4333-8333-333333333333",
    invitee_id: LONG_AGO_DECLINED,
    status: "declined",
    responded_at: daysAgo(30),
  },
];

type StubCall = { table: string; method: string; args: unknown[] };

/**
 * listInvitableUsers runs five queries and joins them in memory, so the fake
 * only has to hand back a row set per table and stay chainable in between.
 * Calls are recorded so a test can assert how the search term was passed.
 */
function createSupabaseStub(calls: StubCall[] = []) {
  const results: Record<string, unknown[]> = {
    profiles: PROFILES,
    group_members: GROUP_MEMBERS,
    group_invitations: GROUP_INVITATIONS,
    group_join_requests: GROUP_JOIN_REQUESTS,
    groups: [{ id: GROUP, created_by: ME }],
  };

  return {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      for (const method of [
        "select",
        "neq",
        "or",
        "ilike",
        "limit",
        "eq",
        "in",
        "order",
        "single",
      ]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: results[table] ?? [], error: null }).then(resolve);
      return builder;
    },
  } as unknown as SupabaseClient<Database>;
}

describe("SupabaseGroupInvitationRepository.listInvitableUsers", () => {
  it("marks someone with a pending invitation and hands back its id", async () => {
    const repo = new SupabaseGroupInvitationRepository(createSupabaseStub());

    const results = await repo.listInvitableUsers(ME, GROUP, "user");

    expect(results.find((r) => r.id === INVITED)).toMatchObject({
      invitationStatus: "invited",
      invitationId: INVITATION,
    });
  });

  it("marks an existing group member", async () => {
    const repo = new SupabaseGroupInvitationRepository(createSupabaseStub());

    const results = await repo.listInvitableUsers(ME, GROUP, "user");

    expect(results.find((r) => r.id === MEMBER)).toMatchObject({
      invitationStatus: "member",
      invitationId: null,
    });
  });

  it("marks someone who already asked to join", async () => {
    const repo = new SupabaseGroupInvitationRepository(createSupabaseStub());

    const results = await repo.listInvitableUsers(ME, GROUP, "user");

    expect(results.find((r) => r.id === REQUESTER)).toMatchObject({
      invitationStatus: "requested",
      invitationId: null,
    });
  });

  it("leaves an unrelated person invitable", async () => {
    const repo = new SupabaseGroupInvitationRepository(createSupabaseStub());

    const results = await repo.listInvitableUsers(ME, GROUP, "user");

    expect(results.find((r) => r.id === STRANGER)).toMatchObject({
      invitationStatus: "none",
      invitationId: null,
    });
  });

  it("reports someone inside the decline cooldown as invited, with no id to withdraw", async () => {
    const repo = new SupabaseGroupInvitationRepository(createSupabaseStub());

    const results = await repo.listInvitableUsers(ME, GROUP, "user");

    // invite_to_group would refuse a re-invite here and reports the same code
    // as for a live invitation, so the list must not offer an Invite button
    expect(results.find((r) => r.id === DECLINED)).toMatchObject({
      invitationStatus: "invited",
      invitationId: null,
    });
  });

  it("makes someone invitable again once the decline cooldown has passed", async () => {
    const repo = new SupabaseGroupInvitationRepository(createSupabaseStub());

    const results = await repo.listInvitableUsers(ME, GROUP, "user");

    expect(results.find((r) => r.id === LONG_AGO_DECLINED)).toMatchObject({
      invitationStatus: "none",
      invitationId: null,
    });
  });

  it("passes the search term as two ilike values rather than an or() filter", async () => {
    const calls: StubCall[] = [];
    const repo = new SupabaseGroupInvitationRepository(createSupabaseStub(calls));

    // A comma would split a PostgREST or() filter into malformed fragments
    await repo.listInvitableUsers(ME, GROUP, "Muller, Anna");

    expect(calls.some((call) => call.method === "or")).toBe(false);
    expect(calls.filter((call) => call.method === "ilike").map((call) => call.args)).toEqual([
      ["username", "%Muller, Anna%"],
      ["full_name", "%Muller, Anna%"],
    ]);
  });

  it("strips wildcards so a term matches literally", async () => {
    const calls: StubCall[] = [];
    const repo = new SupabaseGroupInvitationRepository(createSupabaseStub(calls));

    await repo.listInvitableUsers(ME, GROUP, "a%_*b");

    expect(calls.find((call) => call.method === "ilike")?.args).toEqual(["username", "%ab%"]);
  });

  it("returns nothing for a blank query without touching the database", async () => {
    const repo = new SupabaseGroupInvitationRepository(createSupabaseStub());

    await expect(repo.listInvitableUsers(ME, GROUP, "   ")).resolves.toEqual([]);
  });
});

describe("SupabaseGroupInvitationRepository.isGroupCreator", () => {
  function createGroupsStub(row: { id: string } | null) {
    return {
      from(table: string) {
        if (table !== "groups") {
          throw new Error(`unexpected table ${table}`);
        }
        const builder: Record<string, unknown> = {};
        for (const method of ["select", "eq"]) {
          builder[method] = () => builder;
        }
        builder.maybeSingle = () => Promise.resolve({ data: row, error: null });
        return builder;
      },
    } as unknown as SupabaseClient<Database>;
  }

  it("returns true when the caller created the group", async () => {
    const repo = new SupabaseGroupInvitationRepository(createGroupsStub({ id: GROUP }));

    await expect(repo.isGroupCreator(GROUP, ME)).resolves.toBe(true);
  });

  it("returns false for a missing group, the same as for a non-creator", async () => {
    const repo = new SupabaseGroupInvitationRepository(createGroupsStub(null));

    await expect(repo.isGroupCreator(GROUP, STRANGER)).resolves.toBe(false);
  });
});

describe("SupabaseGroupInvitationRepository.listSent", () => {
  const PENDING_INVITEE = "00000000-0000-4000-8000-000000000010";
  const ALREADY_MEMBER_INVITEE = "00000000-0000-4000-8000-000000000011";

  const SENT_ROWS = [
    {
      id: "aaaaaaaa-0000-4000-8000-000000000001",
      group_id: GROUP,
      invitee_id: PENDING_INVITEE,
      created_at: "2026-01-01T00:00:00Z",
      profiles: {
        id: PENDING_INVITEE,
        username: "pending",
        full_name: "Pending Invitee",
        avatar_url: null,
      },
    },
    {
      id: "aaaaaaaa-0000-4000-8000-000000000002",
      group_id: GROUP,
      invitee_id: ALREADY_MEMBER_INVITEE,
      created_at: "2026-01-02T00:00:00Z",
      profiles: {
        id: ALREADY_MEMBER_INVITEE,
        username: "joined",
        full_name: "Already Joined",
        avatar_url: null,
      },
    },
  ];

  function createListSentStub() {
    const results: Record<string, unknown[]> = {
      group_invitations: SENT_ROWS,
      // Became a member through some other path (invite link, or an approved
      // join request) while the invitation row is still "pending"
      group_members: [{ user_id: ALREADY_MEMBER_INVITEE }],
    };

    return {
      from(table: string) {
        const builder: Record<string, unknown> = {};
        for (const method of ["select", "eq", "in", "order"]) {
          builder[method] = () => builder;
        }
        builder.then = (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: results[table] ?? [], error: null }).then(resolve);
        return builder;
      },
    } as unknown as SupabaseClient<Database>;
  }

  it("excludes an invitee who already became a member", async () => {
    const repo = new SupabaseGroupInvitationRepository(createListSentStub());

    const results = await repo.listSent(GROUP);

    expect(results.map((r) => r.invitee.id)).toEqual([PENDING_INVITEE]);
  });
});
