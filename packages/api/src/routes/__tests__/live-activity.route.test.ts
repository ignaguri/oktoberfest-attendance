import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import { createAuthRequest, createMockUser, createTestApp } from "../../__tests__/helpers/test-server";

const upsert = vi.fn();
const deleteToken = vi.fn();

vi.mock("../../repositories/supabase/live-activity-token.repository", () => ({
  SupabaseLiveActivityTokenRepository: vi.fn().mockImplementation(function () {
    return { upsert, deleteToken };
  }),
}));

import liveActivityRoute from "../live-activity.route";

const festivalId = "123e4567-e89b-12d3-a456-426614174000";
const IOS_TOKEN = "ab".repeat(32);

describe("Live activity token routes", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockUser: ReturnType<typeof createMockUser>;

  beforeEach(() => {
    app = createTestApp();
    mockUser = createMockUser();
    app.use("*", async (c, next) => {
      c.set("user", mockUser);
      c.set("supabase", createMockSupabase());
      await next();
    });
    app.route("/", liveActivityRoute);
    upsert.mockResolvedValue(undefined);
    deleteToken.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("registers an iOS token for the caller", async () => {
    const body = {
      platform: "ios",
      token: IOS_TOKEN,
      apnsEnvironment: "production",
      festivalId,
      date: "2026-10-03",
    };
    const response = await app.request(
      createAuthRequest("/live-activity/token", { method: "POST", body: JSON.stringify(body) }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(upsert).toHaveBeenCalledWith(mockUser.id, body);
  });

  it("rejects an iOS token without an APNs environment", async () => {
    const response = await app.request(
      createAuthRequest("/live-activity/token", {
        method: "POST",
        body: JSON.stringify({
          platform: "ios",
          token: IOS_TOKEN,
          apnsEnvironment: null,
          festivalId,
          date: "2026-10-03",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("deletes the caller's token", async () => {
    const response = await app.request(
      createAuthRequest("/live-activity/token", {
        method: "DELETE",
        body: JSON.stringify({ token: "abc123" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(deleteToken).toHaveBeenCalledWith(mockUser.id, "abc123");
  });
});
