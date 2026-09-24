import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import { createAuthRequest, createMockUser, createTestApp } from "../../__tests__/helpers/test-server";

const service = vi.hoisted(() => ({
  getDayPrompt: vi.fn(),
  submit: vi.fn(),
  dismissDayPrompt: vi.fn(),
  listForAdmin: vi.fn(),
}));

vi.mock("../../services/feedback.service", () => ({
  FeedbackService: vi.fn().mockImplementation(function () {
    return service;
  }),
}));

import feedbackRoute from "../feedback.route";

const FESTIVAL_ID = "22222222-2222-4222-8222-222222222222";

describe("Feedback routes", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockUser: ReturnType<typeof createMockUser>;

  beforeEach(() => {
    app = createTestApp();
    mockUser = createMockUser();
    app.use("*", async (c, next) => {
      if (!c.req.header("Authorization")) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      c.set("user", mockUser);
      c.set("supabase", createMockSupabase());
      await next();
    });
    app.route("/", feedbackRoute);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the day prompt", async () => {
    service.getDayPrompt.mockResolvedValue({ festivalId: FESTIVAL_ID, festivalName: "Oktoberfest 2026", day: "2026-09-23" });
    const response = await app.request(createAuthRequest("/feedback/prompt", { method: "GET" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      prompt: { festivalId: FESTIVAL_ID, festivalName: "Oktoberfest 2026", day: "2026-09-23" },
    });
    expect(service.getDayPrompt).toHaveBeenCalledWith(mockUser.id);
  });

  it("requires auth", async () => {
    const response = await app.request("/feedback/prompt");
    expect(response.status).toBe(401);
  });

  it("submits feedback with the client headers as context", async () => {
    service.submit.mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444" });
    const response = await app.request(
      createAuthRequest("/feedback", {
        method: "POST",
        headers: { "X-Client-Platform": "android", "X-Client-Version": "1.9.0" },
        body: JSON.stringify({ kind: "bug", message: "It crashed" }),
      }),
    );
    expect(response.status).toBe(201);
    expect(service.submit).toHaveBeenCalledWith(
      { userId: mockUser.id, userEmail: mockUser.email ?? null, platform: "android", appVersion: "1.9.0" },
      { kind: "bug", message: "It crashed" },
    );
  });

  it("rejects a bug report without text", async () => {
    const response = await app.request(
      createAuthRequest("/feedback", { method: "POST", body: JSON.stringify({ kind: "bug", message: " " }) }),
    );
    expect(response.status).toBe(400);
    expect(service.submit).not.toHaveBeenCalled();
  });

  it("dismisses the day prompt", async () => {
    const response = await app.request(
      createAuthRequest("/feedback/prompt/dismiss", {
        method: "POST",
        body: JSON.stringify({ festivalId: FESTIVAL_ID, day: "2026-09-23" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(service.dismissDayPrompt).toHaveBeenCalledWith(mockUser.id, FESTIVAL_ID, "2026-09-23");
  });

  it("lists feedback for admins with the kind filter and default limit", async () => {
    service.listForAdmin.mockResolvedValue([]);
    const response = await app.request(createAuthRequest("/admin/feedback?kind=idea", { method: "GET" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(service.listForAdmin).toHaveBeenCalledWith({ kind: "idea", limit: 100 });
  });
});
