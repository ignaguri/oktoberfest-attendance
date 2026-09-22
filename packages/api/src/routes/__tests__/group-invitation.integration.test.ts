// Integration test: requires a running local Supabase.
// Run with the env from Step 2, then:
//   cd packages/api && npx vitest run --config vitest.integration.config.ts src/routes/__tests__/group-invitation.integration.test.ts
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../__tests__/helpers/test-supabase";
import { createTestApp } from "../../__tests__/helpers/test-server";
import { authMiddleware } from "../../middleware/auth";
import groupInvitationRoutes from "../group-invitation.route";
import groupJoinRequestRoutes from "../group-join-request.route";
import groupRoutes from "../group.route";

type TestUser = { id: string; token: string };

const admin = createTestSupabaseAdmin();
const createdUserIds: string[] = [];
const createdFestivalIds: string[] = [];

function mountRoutes() {
  const app = createTestApp();
  app.use("*", authMiddleware);
  // Same order as packages/api/src/index.ts: the literal paths must win
  app.route("/", groupJoinRequestRoutes);
  app.route("/", groupInvitationRoutes);
  app.route("/", groupRoutes);
  return app;
}

async function createTestUser(): Promise<TestUser> {
  const anon = createTestSupabaseAnon();
  const { data, error } = await anon.auth.signUp({
    email: `invitation-${randomUUID()}@integration-test.com`,
    password: "test-password-123!",
  });
  if (error || !data.user || !data.session) {
    throw new Error(`Failed to create test user: ${error?.message ?? "unknown error"}`);
  }
  createdUserIds.push(data.user.id);
  return { id: data.user.id, token: data.session.access_token };
}

async function createTestFestival(): Promise<string> {
  const suffix = randomUUID();
  const { data, error } = await admin
    .from("festivals")
    .insert({
      name: `Invitation Test Festival ${suffix}`,
      short_name: `invitation-${suffix}`.slice(0, 40),
      festival_type: "oktoberfest",
      start_date: "2024-09-21",
      end_date: "2024-10-06",
      beer_cost: 16.2,
      location: "Test Location",
      timezone: "Europe/Berlin",
      is_active: false,
      status: "ended",
    })
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to create test festival: ${error?.message}`);
  }
  createdFestivalIds.push(data.id);
  return data.id;
}

async function createTestGroup(creatorId: string, festivalId: string, name: string) {
  const { data, error } = await admin.rpc("create_group_with_member", {
    p_group_name: name,
    p_user_id: creatorId,
    p_festival_id: festivalId,
    p_winning_criteria_id: 2,
  });
  if (error || !data?.[0]) {
    throw new Error(`Failed to create test group: ${error?.message}`);
  }
  return data[0].group_id as string;
}

async function setup() {
  const creator = await createTestUser();
  const invitee = await createTestUser();
  const outsider = await createTestUser();
  const festivalId = await createTestFestival();
  const groupName = `Invitation Group ${randomUUID()}`;
  const groupId = await createTestGroup(creator.id, festivalId, groupName);
  return { app: mountRoutes(), creator, invitee, outsider, festivalId, groupId, groupName };
}

function call(
  app: ReturnType<typeof mountRoutes>,
  user: TestUser,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
) {
  return app.request(path, {
    method,
    headers: {
      Authorization: `Bearer ${user.token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function errorCode(response: Response): Promise<string | undefined> {
  const body = (await response.json()) as { error?: { code?: string } };
  return body.error?.code;
}

type IncomingInvitation = {
  id: string;
  groupId: string;
  groupName: string;
  inviter: { id: string };
};

async function incomingFor(app: ReturnType<typeof mountRoutes>, user: TestUser) {
  const response = await call(app, user, "GET", "/groups/invitations/incoming");
  // Also proves route ordering: a 400 here means GET /groups/{id} matched first
  // and rejected "invitations" as a malformed uuid
  expect(response.status).toBe(200);
  const body = (await response.json()) as { data: IncomingInvitation[] };
  return body.data;
}

describe("group invitations (integration)", () => {
  beforeAll(() => {
    // Never trigger real Novu workflows from tests
    delete process.env.NOVU_API_KEY;
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await admin.from("group_invitations").delete().in("invitee_id", createdUserIds);
      await admin.from("group_join_requests").delete().in("requester_id", createdUserIds);
    }
    for (const festivalId of createdFestivalIds) {
      await admin.from("groups").delete().eq("festival_id", festivalId);
      await admin.from("festivals").delete().eq("id", festivalId);
    }
    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
  });

  it("lets the invitee accept, which makes them a member", async () => {
    const { app, creator, invitee, groupId, groupName } = await setup();

    const inviteResponse = await call(app, creator, "POST", `/groups/${groupId}/invitations`, {
      inviteeId: invitee.id,
    });
    expect(inviteResponse.status).toBe(200);

    const incoming = await incomingFor(app, invitee);
    expect(incoming).toHaveLength(1);
    expect(incoming[0].groupId).toBe(groupId);
    expect(incoming[0].inviter.id).toBe(creator.id);
    // The group name reaches a non-member through list_my_group_invitations
    expect(incoming[0].groupName).toBe(groupName);

    const acceptResponse = await call(
      app,
      invitee,
      "POST",
      `/groups/invitations/${incoming[0].id}/accept`,
    );
    expect(acceptResponse.status).toBe(200);

    const { data: membership } = await admin
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", invitee.id);
    expect(membership).toHaveLength(1);

    expect(await incomingFor(app, invitee)).toHaveLength(0);
  });

  it("never puts the group's secrets in the invitation payload", async () => {
    const { app, creator, invitee, groupId } = await setup();
    await call(app, creator, "POST", `/groups/${groupId}/invitations`, { inviteeId: invitee.id });

    const response = await call(app, invitee, "GET", "/groups/invitations/incoming");
    const raw = await response.text();

    expect(raw).not.toContain("inviteToken");
    expect(raw).not.toContain("invite_token");
    expect(raw).not.toContain("password");
  });

  it("rejects a second invitation while one is pending", async () => {
    const { app, creator, invitee, groupId } = await setup();
    await call(app, creator, "POST", `/groups/${groupId}/invitations`, { inviteeId: invitee.id });

    const second = await call(app, creator, "POST", `/groups/${groupId}/invitations`, {
      inviteeId: invitee.id,
    });
    expect(second.status).toBe(409);
    expect(await errorCode(second)).toBe("GROUP_INVITATION_PENDING");
  });

  it("hides a decline behind the pending code for 7 days", async () => {
    const { app, creator, invitee, groupId } = await setup();
    await call(app, creator, "POST", `/groups/${groupId}/invitations`, { inviteeId: invitee.id });
    const [invitation] = await incomingFor(app, invitee);

    const decline = await call(
      app,
      invitee,
      "POST",
      `/groups/invitations/${invitation.id}/decline`,
    );
    expect(decline.status).toBe(200);

    // The creator gets the same code a live invitation returns, so a decline
    // is indistinguishable from one still waiting
    const tooSoon = await call(app, creator, "POST", `/groups/${groupId}/invitations`, {
      inviteeId: invitee.id,
    });
    expect(tooSoon.status).toBe(409);
    expect(await errorCode(tooSoon)).toBe("GROUP_INVITATION_PENDING");

    await admin
      .from("group_invitations")
      .update({ responded_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() })
      .eq("id", invitation.id);

    const later = await call(app, creator, "POST", `/groups/${groupId}/invitations`, {
      inviteeId: invitee.id,
    });
    expect(later.status).toBe(200);
  });

  it("only lets the creator invite and only the invitee answer", async () => {
    const { app, creator, invitee, outsider, groupId } = await setup();

    const byOutsider = await call(app, outsider, "POST", `/groups/${groupId}/invitations`, {
      inviteeId: invitee.id,
    });
    expect(byOutsider.status).toBe(403);
    expect(await errorCode(byOutsider)).toBe("NOT_GROUP_CREATOR");

    await call(app, creator, "POST", `/groups/${groupId}/invitations`, { inviteeId: invitee.id });
    const [invitation] = await incomingFor(app, invitee);

    const accept = await call(
      app,
      outsider,
      "POST",
      `/groups/invitations/${invitation.id}/accept`,
    );
    expect(accept.status).toBe(403);
    expect(await errorCode(accept)).toBe("NOT_INVITATION_RECIPIENT");

    expect(await incomingFor(app, outsider)).toHaveLength(0);

    const outsiderClient = createTestSupabaseWithAuth(outsider.token);
    const { data: visible } = await outsiderClient
      .from("group_invitations")
      .select("id")
      .eq("group_id", groupId);
    expect(visible).toHaveLength(0);
  });

  it("refuses to invite someone who already asked to join", async () => {
    const { app, creator, invitee, groupId } = await setup();

    const request = await call(app, invitee, "POST", `/groups/${groupId}/join-requests`);
    expect(request.status).toBe(200);

    const invite = await call(app, creator, "POST", `/groups/${groupId}/invitations`, {
      inviteeId: invitee.id,
    });
    expect(invite.status).toBe(409);
    expect(await errorCode(invite)).toBe("JOIN_REQUEST_PENDING");
  });

  it("refuses to invite an existing member or yourself", async () => {
    const { app, creator, groupId } = await setup();

    const self = await call(app, creator, "POST", `/groups/${groupId}/invitations`, {
      inviteeId: creator.id,
    });
    expect(self.status).toBe(403);
    expect(await errorCode(self)).toBe("CANNOT_INVITE_SELF");

    const member = await createTestUser();
    await admin.from("group_members").insert({ group_id: groupId, user_id: member.id });

    const response = await call(app, creator, "POST", `/groups/${groupId}/invitations`, {
      inviteeId: member.id,
    });
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe("ALREADY_GROUP_MEMBER");
  });

  it("flags invited, member and requested people in the search", async () => {
    const { app, creator, invitee, groupId } = await setup();
    await call(app, creator, "POST", `/groups/${groupId}/invitations`, { inviteeId: invitee.id });

    // handle_new_user only copies full_name and avatar_url out of the signup
    // metadata, and createTestUser sends none, so a fresh profile has neither a
    // username nor a full name and matches no ilike search. Give it one.
    const handle = `inv${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    await admin.from("profiles").update({ username: handle }).eq("id", invitee.id);

    const response = await call(
      app,
      creator,
      "GET",
      `/groups/${groupId}/invitable-users?q=${handle}`,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<{ id: string; invitationStatus: string; invitationId: string | null }>;
    };

    const row = body.data.find((r) => r.id === invitee.id);
    expect(row?.invitationStatus).toBe("invited");
    expect(row?.invitationId).not.toBeNull();

    // Never offer the caller themselves, even when they match the query
    await admin.from("profiles").update({ username: `${handle}creator` }).eq("id", creator.id);
    const again = await call(
      app,
      creator,
      "GET",
      `/groups/${groupId}/invitable-users?q=${handle}`,
    );
    const againBody = (await again.json()) as { data: Array<{ id: string }> };
    expect(againBody.data.find((r) => r.id === creator.id)).toBeUndefined();
  });

  it("reports a person as a member, not invited, once their pending invitation overlaps membership", async () => {
    // listInvitableUsers resolves member > invited > requested > none. Every
    // stub-based unit fixture matches exactly one condition, so the ordering
    // itself is unverified there. This is reachable in production: someone is
    // invited, then joins via the invite link while the invitation is still
    // pending (accept_group_invitation's ON CONFLICT DO NOTHING allows exactly
    // this).
    const { app, creator, invitee, groupId } = await setup();
    await call(app, creator, "POST", `/groups/${groupId}/invitations`, { inviteeId: invitee.id });

    const handle = `prec${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    await admin.from("profiles").update({ username: handle }).eq("id", invitee.id);

    // Make them a member directly while their invitation is still pending,
    // mirroring the invite-link-in-the-meantime scenario without going
    // through the accept endpoint (which would resolve the invitation).
    await admin.from("group_members").insert({ group_id: groupId, user_id: invitee.id });

    const { data: stillPending } = await admin
      .from("group_invitations")
      .select("status")
      .eq("group_id", groupId)
      .eq("invitee_id", invitee.id)
      .single();
    expect(stillPending?.status).toBe("pending");

    const response = await call(
      app,
      creator,
      "GET",
      `/groups/${groupId}/invitable-users?q=${handle}`,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<{ id: string; invitationStatus: string }>;
    };

    const row = body.data.find((r) => r.id === invitee.id);
    expect(row?.invitationStatus).toBe("member");
  });

  it("withdraws a pending invitation", async () => {
    const { app, creator, invitee, groupId } = await setup();
    await call(app, creator, "POST", `/groups/${groupId}/invitations`, { inviteeId: invitee.id });
    const [invitation] = await incomingFor(app, invitee);

    const cancel = await call(app, creator, "DELETE", `/groups/invitations/${invitation.id}`);
    expect(cancel.status).toBe(200);

    expect(await incomingFor(app, invitee)).toHaveLength(0);

    const sent = await call(app, creator, "GET", `/groups/${groupId}/invitations`);
    const sentBody = (await sent.json()) as { data: unknown[] };
    expect(sentBody.data).toHaveLength(0);
  });

  it("only lets the creator list sent invitations or search invitable users", async () => {
    const { app, outsider, groupId } = await setup();

    const sent = await call(app, outsider, "GET", `/groups/${groupId}/invitations`);
    expect(sent.status).toBe(403);
    expect(await errorCode(sent)).toBe("NOT_GROUP_CREATOR");

    const invitable = await call(app, outsider, "GET", `/groups/${groupId}/invitable-users?q=a`);
    expect(invitable.status).toBe(403);
    expect(await errorCode(invitable)).toBe("NOT_GROUP_CREATOR");
  });

  it("gives the same error for a missing group as for a non-creator, on both endpoints", async () => {
    const { app, outsider } = await setup();
    const missingGroupId = randomUUID();

    const sent = await call(app, outsider, "GET", `/groups/${missingGroupId}/invitations`);
    expect(sent.status).toBe(403);
    expect(await errorCode(sent)).toBe("NOT_GROUP_CREATOR");

    const invitable = await call(
      app,
      outsider,
      "GET",
      `/groups/${missingGroupId}/invitable-users?q=a`,
    );
    expect(invitable.status).toBe(403);
    expect(await errorCode(invitable)).toBe("NOT_GROUP_CREATOR");
  });

  it("drops an invitee from the sent list once they became a member some other way", async () => {
    // Mirrors "reports a person as a member" above, but for the creator's own
    // sent list: it must not keep showing "invitation sent" for someone who
    // is now listed as a member right below it.
    const { app, creator, invitee, groupId } = await setup();
    await call(app, creator, "POST", `/groups/${groupId}/invitations`, { inviteeId: invitee.id });

    await admin.from("group_members").insert({ group_id: groupId, user_id: invitee.id });

    const sent = await call(app, creator, "GET", `/groups/${groupId}/invitations`);
    expect(sent.status).toBe(200);
    const sentBody = (await sent.json()) as { data: Array<{ invitee: { id: string } }> };
    expect(sentBody.data.find((row) => row.invitee.id === invitee.id)).toBeUndefined();
  });
});
