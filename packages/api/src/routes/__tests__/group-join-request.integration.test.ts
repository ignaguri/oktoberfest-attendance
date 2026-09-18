// Integration test: requires a running local Supabase.
// Run with the env from Task 4 Step 2, then:
//   cd packages/api && npx vitest run --config vitest.integration.config.ts src/routes/__tests__/group-join-request.integration.test.ts
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../__tests__/helpers/test-supabase";
import { createTestApp } from "../../__tests__/helpers/test-server";
import { authMiddleware } from "../../middleware/auth";
import groupJoinRequestRoutes from "../group-join-request.route";
import groupRoutes from "../group.route";

type TestUser = { id: string; token: string };

const admin = createTestSupabaseAdmin();
const createdUserIds: string[] = [];
const createdFestivalIds: string[] = [];

function mountRoutes() {
  const app = createTestApp();
  app.use("*", authMiddleware);
  // Same order as packages/api/src/index.ts: join requests before groups
  app.route("/", groupJoinRequestRoutes);
  app.route("/", groupRoutes);
  return app;
}

async function createTestUser(): Promise<TestUser> {
  const anon = createTestSupabaseAnon();
  const { data, error } = await anon.auth.signUp({
    email: `join-request-${randomUUID()}@integration-test.com`,
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
      name: `Join Request Test Festival ${suffix}`,
      short_name: `join-request-${suffix}`.slice(0, 40),
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
  const requester = await createTestUser();
  const outsider = await createTestUser();
  const festivalId = await createTestFestival();
  const groupName = `Join Request Group ${randomUUID()}`;
  const groupId = await createTestGroup(creator.id, festivalId, groupName);
  return { app: mountRoutes(), creator, requester, outsider, festivalId, groupId, groupName };
}

function call(
  app: ReturnType<typeof mountRoutes>,
  user: TestUser,
  method: "GET" | "POST" | "DELETE",
  path: string,
) {
  return app.request(path, { method, headers: { Authorization: `Bearer ${user.token}` } });
}

async function errorCode(response: Response): Promise<string | undefined> {
  const body = (await response.json()) as { error?: { code?: string } };
  return body.error?.code;
}

async function incomingFor(app: ReturnType<typeof mountRoutes>, user: TestUser) {
  const response = await call(app, user, "GET", "/groups/join-requests/incoming");
  expect(response.status).toBe(200);
  const body = (await response.json()) as { data: Array<{ id: string; groupId: string; requester: { id: string } }> };
  return body.data;
}

describe("group join requests (integration)", () => {
  beforeAll(() => {
    // Never trigger real Novu workflows from tests
    delete process.env.NOVU_API_KEY;
  });

  afterAll(async () => {
    for (const festivalId of createdFestivalIds) {
      await admin.from("groups").delete().eq("festival_id", festivalId);
      await admin.from("festivals").delete().eq("id", festivalId);
    }
    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
  });

  it("lets the creator accept a request, which makes the requester a member", async () => {
    const { app, creator, requester, groupId } = await setup();

    const requestResponse = await call(app, requester, "POST", `/groups/${groupId}/join-requests`);
    expect(requestResponse.status).toBe(200);

    const incoming = await incomingFor(app, creator);
    expect(incoming).toHaveLength(1);
    expect(incoming[0].groupId).toBe(groupId);
    expect(incoming[0].requester.id).toBe(requester.id);

    const acceptResponse = await call(
      app,
      creator,
      "POST",
      `/groups/join-requests/${incoming[0].id}/accept`,
    );
    expect(acceptResponse.status).toBe(200);

    const { data: membership } = await admin
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", requester.id);
    expect(membership).toHaveLength(1);

    const { data: request } = await admin
      .from("group_join_requests")
      .select("status, responded_at")
      .eq("id", incoming[0].id)
      .single();
    expect(request?.status).toBe("accepted");
    expect(request?.responded_at).not.toBeNull();

    expect(await incomingFor(app, creator)).toHaveLength(0);
  });

  it("rejects a second request while one is pending", async () => {
    const { app, requester, groupId } = await setup();
    await call(app, requester, "POST", `/groups/${groupId}/join-requests`);

    const second = await call(app, requester, "POST", `/groups/${groupId}/join-requests`);
    expect(second.status).toBe(409);
    expect(await errorCode(second)).toBe("JOIN_REQUEST_PENDING");
  });

  it("keeps a declined requester out for 7 days, then allows a new request", async () => {
    const { app, creator, requester, groupId } = await setup();
    await call(app, requester, "POST", `/groups/${groupId}/join-requests`);
    const [request] = await incomingFor(app, creator);

    const decline = await call(app, creator, "POST", `/groups/join-requests/${request.id}/decline`);
    expect(decline.status).toBe(200);

    const tooSoon = await call(app, requester, "POST", `/groups/${groupId}/join-requests`);
    expect(tooSoon.status).toBe(409);
    expect(await errorCode(tooSoon)).toBe("JOIN_REQUEST_PENDING");

    await admin
      .from("group_join_requests")
      .update({ responded_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() })
      .eq("id", request.id);

    const later = await call(app, requester, "POST", `/groups/${groupId}/join-requests`);
    expect(later.status).toBe(200);
  });

  it("only lets the creator answer, and hides requests from other users", async () => {
    const { app, requester, outsider, groupId } = await setup();
    await call(app, requester, "POST", `/groups/${groupId}/join-requests`);

    const { data: rows } = await admin
      .from("group_join_requests")
      .select("id")
      .eq("group_id", groupId);
    const requestId = rows?.[0]?.id as string;

    const accept = await call(app, outsider, "POST", `/groups/join-requests/${requestId}/accept`);
    expect(accept.status).toBe(403);
    expect(await errorCode(accept)).toBe("NOT_GROUP_CREATOR");

    const decline = await call(app, outsider, "POST", `/groups/join-requests/${requestId}/decline`);
    expect(decline.status).toBe(403);

    expect(await incomingFor(app, outsider)).toHaveLength(0);

    const outsiderClient = createTestSupabaseWithAuth(outsider.token);
    const { data: visible } = await outsiderClient
      .from("group_join_requests")
      .select("id")
      .eq("group_id", groupId);
    expect(visible).toHaveLength(0);
  });

  it("tells a member they are already in", async () => {
    const { app, creator, groupId } = await setup();
    const response = await call(app, creator, "POST", `/groups/${groupId}/join-requests`);
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe("ALREADY_GROUP_MEMBER");
  });

  it("accepts cleanly when the requester joined through a link meanwhile", async () => {
    const { app, creator, requester, groupId } = await setup();
    await call(app, requester, "POST", `/groups/${groupId}/join-requests`);
    const { data: rows } = await admin
      .from("group_join_requests")
      .select("id")
      .eq("group_id", groupId);
    const requestId = rows?.[0]?.id as string;

    await admin.from("group_members").insert({ group_id: groupId, user_id: requester.id });

    // Already a member, so the creator no longer sees it
    expect(await incomingFor(app, creator)).toHaveLength(0);

    const accept = await call(app, creator, "POST", `/groups/join-requests/${requestId}/accept`);
    expect(accept.status).toBe(200);

    const { data: membership } = await admin
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", requester.id);
    expect(membership).toHaveLength(1);
  });

  it("flags pending requests in search and clears them on cancel", async () => {
    const { app, requester, festivalId, groupId, groupName } = await setup();
    const searchPath = `/groups/search?name=${encodeURIComponent(groupName)}&festivalId=${festivalId}`;

    const before = await call(app, requester, "GET", searchPath);
    const beforeBody = (await before.json()) as { data: Array<{ id: string; joinRequestPending?: boolean }> };
    expect(beforeBody.data.find((g) => g.id === groupId)?.joinRequestPending).toBe(false);

    await call(app, requester, "POST", `/groups/${groupId}/join-requests`);

    const pending = await call(app, requester, "GET", searchPath);
    const pendingBody = (await pending.json()) as { data: Array<{ id: string; joinRequestPending?: boolean }> };
    expect(pendingBody.data.find((g) => g.id === groupId)?.joinRequestPending).toBe(true);

    const cancel = await call(app, requester, "DELETE", `/groups/${groupId}/join-requests/mine`);
    expect(cancel.status).toBe(200);

    const after = await call(app, requester, "GET", searchPath);
    const afterBody = (await after.json()) as { data: Array<{ id: string; joinRequestPending?: boolean }> };
    expect(afterBody.data.find((g) => g.id === groupId)?.joinRequestPending).toBe(false);
  });
});
