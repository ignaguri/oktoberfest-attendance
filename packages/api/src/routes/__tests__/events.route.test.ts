import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import {
  createAuthRequest,
  createMockUser,
  createTestApp,
} from "../../__tests__/helpers/test-server";
import eventsRoutes from "../events.route";

// analytics_record_events is service_role only, so the repository uses the
// service-role client; stub it so the tests need no credentials.
const mockRpc = vi.fn();

vi.mock("../../utils/admin-client", () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION = "6f1c2f5e-2b8a-4f7e-9d0a-1c2b3d4e5f60";

function body(events: unknown[]) {
  return JSON.stringify({ events });
}

function screenEvent(extra: Record<string, unknown> = {}) {
  return {
    name: "screen_viewed",
    props: { screen: "/home" },
    occurredAt: new Date().toISOString(),
    sessionId: SESSION,
    ...extra,
  };
}

function post(events: unknown[], headers: Record<string, string> = {}) {
  return createAuthRequest("/events", {
    method: "POST",
    body: body(events),
    headers,
  });
}

describe("POST /events", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: 1, error: null });
    // Stands in for authMiddleware, which guards /v1/* in index.ts.
    app.use("*", async (c, next) => {
      c.set("user", createMockUser({ id: USER_ID }));
      c.set("supabase", createMockSupabase());
      await next();
    });
    app.route("/", eventsRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("records valid events for the token's user, ignoring a body user_id", async () => {
    const res = await app.request(
      post([screenEvent({ user_id: "22222222-2222-4222-8222-222222222222" })], {
        "X-Client-Platform": "ios",
        "X-Client-Version": "1.7.0",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accepted: 1 });
    expect(mockRpc).toHaveBeenCalledWith("analytics_record_events", {
      p_user_id: USER_ID,
      p_events: [
        expect.objectContaining({
          name: "screen_viewed",
          props: { screen: "/home" },
        }),
      ],
      p_platform: "ios",
      p_app_version: "1.7.0",
    });
  });

  it("drops invalid events and still records the rest", async () => {
    const res = await app.request(
      post([screenEvent({ name: "nope" }), screenEvent({ props: { screen: "x" } }), screenEvent()]),
    );
    expect(await res.json()).toEqual({ accepted: 1 });
    expect(mockRpc.mock.calls[0][1].p_events).toHaveLength(1);
  });

  it("does not call the database when nothing is valid", async () => {
    const res = await app.request(post([screenEvent({ name: "nope" })]));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accepted: 0 });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("omits an unrecognized platform header", async () => {
    await app.request(post([screenEvent()], { "X-Client-Platform": "windows" }));
    expect(mockRpc.mock.calls[0][1]).not.toHaveProperty("p_platform");
  });

  it("rejects more than 50 events", async () => {
    const res = await app.request(post(Array.from({ length: 51 }, () => screenEvent())));
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("answers 200 with accepted 0 when the insert fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    const res = await app.request(post([screenEvent()]));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accepted: 0 });
  });
});
