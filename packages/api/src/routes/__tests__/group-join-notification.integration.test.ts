// Integration test: requires a running local Supabase.
//   cd packages/api && npx vitest run --config vitest.integration.config.ts \
//     src/routes/__tests__/group-join-notification.integration.test.ts
//
// Covers Task 7: the three production paths by which someone actually joins a
// group must call NotificationService.notifyGroupJoin. That method has been
// fully implemented (and unit-tested) since before this plan started, but had
// zero non-test call sites, which is why group-join-notification last fired
// on 2025-10-05. This file asserts the call, not notifyGroupJoin's own
// behaviour (already covered by notification-preferences.service.test.ts and
// notification-avatars.service.test.ts).
import { randomUUID } from "crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@prostcounter/db";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
} from "../../__tests__/helpers/test-supabase";
import { createTestApp } from "../../__tests__/helpers/test-server";
import { authMiddleware } from "../../middleware/auth";
import groupJoinRequestRoutes from "../group-join-request.route";
import groupRoutes from "../group.route";

// Stub the service so nothing reaches Novu and the call is observable. This
// is why this file needs its own harness rather than reusing
// group-join-request.integration.test.ts: that file deletes NOVU_API_KEY in
// beforeAll specifically so its other assertions (notifyJoinRequest,
// notifyJoinRequestAccepted) never fire a real workflow. Restoring the key
// there would make those calls live; mocking the class here keeps the key
// restored (so the `if (!novuApiKey) return` early-out in every call site
// under test doesn't swallow the call) while still guaranteeing no HTTP
// request to Novu ever leaves the process.
// group-join-request.route.ts's request/accept handlers also fire
// notifyJoinRequest / notifyJoinRequestAccepted on the same NotificationService
// instance; both need a stub too, or an unmocked call would throw
// "not a function" and fail requests this file's setup steps depend on.
const { notifyGroupJoinMock, notifyJoinRequestMock, notifyJoinRequestAcceptedMock } = vi.hoisted(
  () => ({
    notifyGroupJoinMock: vi.fn(),
    notifyJoinRequestMock: vi.fn(),
    notifyJoinRequestAcceptedMock: vi.fn(),
  }),
);

vi.mock("../../services/notification.service", () => {
  const mocked = {
    NotificationService: class {
      notifyGroupJoin = notifyGroupJoinMock;
      notifyJoinRequest = notifyJoinRequestMock;
      notifyJoinRequestAccepted = notifyJoinRequestAcceptedMock;
    },
  };
  return {
    ...mocked,
    createNotificationService: () =>
      process.env.NOVU_API_KEY ? new mocked.NotificationService() : null,
  };
});

let admin: SupabaseClient<Database>;
const createdUserIds: string[] = [];
const createdFestivalIds: string[] = [];
const createdGroupIds: string[] = [];
const originalNovuApiKey = process.env.NOVU_API_KEY;

function mountRoutes() {
  const app = createTestApp();
  app.use("*", authMiddleware);
  // Same order as packages/api/src/index.ts: join requests before groups.
  app.route("/", groupJoinRequestRoutes);
  app.route("/", groupRoutes);
  return app;
}

type TestUser = { id: string; token: string };

async function createTestUser(): Promise<TestUser> {
  const anon = createTestSupabaseAnon();
  const { data, error } = await anon.auth.signUp({
    email: `group-join-notif-${randomUUID()}@integration-test.com`,
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
      name: `Group Join Notif Test Festival ${suffix}`,
      short_name: `join-notif-${suffix}`.slice(0, 40),
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

async function createTestGroup(creatorId: string, festivalId: string) {
  const { data, error } = await admin.rpc("create_group_with_member", {
    p_group_name: `Group Join Notif Group ${randomUUID()}`,
    p_user_id: creatorId,
    p_festival_id: festivalId,
    p_winning_criteria_id: 2,
  });
  if (error || !data?.[0]) {
    throw new Error(`Failed to create test group: ${error?.message}`);
  }
  const groupId = data[0].group_id as string;
  createdGroupIds.push(groupId);

  const { data: group, error: groupError } = await admin
    .from("groups")
    .select("invite_token")
    .eq("id", groupId)
    .single();
  if (groupError || !group) {
    throw new Error(`Failed to read invite token: ${groupError?.message}`);
  }
  return { groupId, inviteToken: group.invite_token as string };
}

describe("group-join-notification reaches all three join paths", () => {
  beforeAll(() => {
    admin = createTestSupabaseAdmin();
  });

  afterAll(async () => {
    if (createdGroupIds.length > 0) {
      await admin.from("group_members").delete().in("group_id", createdGroupIds);
      await admin.from("groups").delete().in("id", createdGroupIds);
    }
    for (const festivalId of createdFestivalIds) {
      await admin.from("festivals").delete().eq("id", festivalId);
    }
    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    if (originalNovuApiKey === undefined) {
      delete process.env.NOVU_API_KEY;
    } else {
      process.env.NOVU_API_KEY = originalNovuApiKey;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOVU_API_KEY = "test-novu-key";
    notifyGroupJoinMock.mockResolvedValue(undefined);
    notifyJoinRequestMock.mockResolvedValue(undefined);
    notifyJoinRequestAcceptedMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalNovuApiKey === undefined) {
      delete process.env.NOVU_API_KEY;
    } else {
      process.env.NOVU_API_KEY = originalNovuApiKey;
    }
  });

  it("POST /groups/{id}/join announces the join", async () => {
    const app = mountRoutes();
    const creator = await createTestUser();
    const joiner = await createTestUser();
    const festivalId = await createTestFestival();
    const { groupId, inviteToken } = await createTestGroup(creator.id, festivalId);

    const response = await app.request(`/groups/${groupId}/join`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${joiner.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inviteToken }),
    });

    expect(response.status).toBe(200);
    expect(notifyGroupJoinMock).toHaveBeenCalledTimes(1);
    expect(notifyGroupJoinMock).toHaveBeenCalledWith(groupId, joiner.id);
  });

  it("POST /groups/join-by-token announces the join", async () => {
    const app = mountRoutes();
    const creator = await createTestUser();
    const joiner = await createTestUser();
    const festivalId = await createTestFestival();
    const { groupId, inviteToken } = await createTestGroup(creator.id, festivalId);

    const response = await app.request("/groups/join-by-token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${joiner.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inviteToken }),
    });

    expect(response.status).toBe(200);
    expect(notifyGroupJoinMock).toHaveBeenCalledTimes(1);
    expect(notifyGroupJoinMock).toHaveBeenCalledWith(groupId, joiner.id);
  });

  it("accepting a join request announces the join", async () => {
    const app = mountRoutes();
    const creator = await createTestUser();
    const requester = await createTestUser();
    const festivalId = await createTestFestival();
    const { groupId } = await createTestGroup(creator.id, festivalId);

    const requestResponse = await app.request(`/groups/${groupId}/join-requests`, {
      method: "POST",
      headers: { Authorization: `Bearer ${requester.token}` },
    });
    expect(requestResponse.status).toBe(200);

    const incomingResponse = await app.request("/groups/join-requests/incoming", {
      method: "GET",
      headers: { Authorization: `Bearer ${creator.token}` },
    });
    expect(incomingResponse.status).toBe(200);
    const incoming = (await incomingResponse.json()) as { data: Array<{ id: string }> };
    const requestId = incoming.data[0]?.id;
    expect(requestId).toBeDefined();

    // The join-request path calls notifyJoinRequest on the request above, so
    // clear that call before asserting on the accept-path notifyGroupJoin call.
    notifyGroupJoinMock.mockClear();

    const acceptResponse = await app.request(`/groups/join-requests/${requestId}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${creator.token}` },
    });

    expect(acceptResponse.status).toBe(200);
    expect(notifyGroupJoinMock).toHaveBeenCalledTimes(1);
    expect(notifyGroupJoinMock).toHaveBeenCalledWith(groupId, requester.id);
  });
});
