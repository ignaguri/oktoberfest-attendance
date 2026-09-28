import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import {
  createAuthRequest,
  createMockUser,
  createTestApp,
} from "../../__tests__/helpers/test-server";
import adminAnalyticsRoutes from "../admin-analytics.route";

// The metric functions are service_role only, so the repository reaches for the
// service-role client; stub it so the tests need no credentials.
const mockRpc = vi.fn();

vi.mock("../../utils/admin-client", () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
}));

describe("Admin Analytics Routes - Unit Tests", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
    mockRpc.mockReset();

    // Stands in for authMiddleware + requireAdmin, which guard /admin/* in index.ts.
    app.use("*", async (c, next) => {
      c.set("user", createMockUser({ id: "11111111-1111-4111-8111-111111111111" }));
      c.set("supabase", createMockSupabase());
      await next();
    });

    app.route("/", adminAnalyticsRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /admin/analytics/overview", () => {
    it("passes the range to the function and returns the series", async () => {
      mockRpc.mockResolvedValue({
        data: [{ day: "2026-09-01", dau: 3, wau: 5, mau: 9 }],
        error: null,
      });

      const res = await app.request(
        createAuthRequest("/admin/analytics/overview?from=2026-09-01&to=2026-09-01"),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        series: [{ day: "2026-09-01", dau: 3, wau: 5, mau: 9 }],
      });
      expect(mockRpc).toHaveBeenCalledWith("analytics_overview", {
        p_from: "2026-09-01",
        p_to: "2026-09-01",
      });
    });

    it("forwards the platform filter", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      await app.request(
        createAuthRequest("/admin/analytics/overview?from=2026-09-01&to=2026-09-30&platform=ios"),
      );

      expect(mockRpc).toHaveBeenCalledWith("analytics_overview", {
        p_from: "2026-09-01",
        p_to: "2026-09-30",
        p_platform: "ios",
      });
    });

    it("rejects an inverted range without calling the database", async () => {
      const res = await app.request(
        createAuthRequest("/admin/analytics/overview?from=2026-09-30&to=2026-09-01"),
      );

      expect(res.status).toBe(400);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("rejects a range over 400 days", async () => {
      const res = await app.request(
        createAuthRequest("/admin/analytics/overview?from=2025-08-19&to=2026-09-23"),
      );

      expect(res.status).toBe(400);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("rejects an unknown platform", async () => {
      const res = await app.request(
        createAuthRequest("/admin/analytics/overview?from=2026-09-01&to=2026-09-30&platform=web"),
      );

      expect(res.status).toBe(400);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("rejects a missing bound", async () => {
      const res = await app.request(createAuthRequest("/admin/analytics/overview?from=2026-09-01"));

      expect(res.status).toBe(400);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("answers 500 when the function fails", async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });

      const res = await app.request(
        createAuthRequest("/admin/analytics/overview?from=2026-09-01&to=2026-09-30"),
      );

      expect(res.status).toBe(500);
    });
  });

  describe("GET /admin/analytics/features", () => {
    it("lifts active_users out of the rows", async () => {
      mockRpc.mockResolvedValue({
        data: [
          { feature: "attendance", users: 3, events: 5, active_users: 7 },
          { feature: "photos", users: 0, events: 0, active_users: 7 },
        ],
        error: null,
      });

      const res = await app.request(
        createAuthRequest("/admin/analytics/features?from=2026-09-01&to=2026-09-30"),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        activeUsers: 7,
        features: [
          { feature: "attendance", users: 3, events: 5 },
          { feature: "photos", users: 0, events: 0 },
        ],
      });
      expect(mockRpc).toHaveBeenCalledWith("analytics_feature_usage", {
        p_from: "2026-09-01",
        p_to: "2026-09-30",
      });
    });

    it("reports zero active users when there are no rows", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const res = await app.request(
        createAuthRequest("/admin/analytics/features?from=2026-09-01&to=2026-09-30"),
      );

      expect(await res.json()).toEqual({ activeUsers: 0, features: [] });
    });

    it("forwards the platform filter", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      await app.request(
        createAuthRequest("/admin/analytics/features?from=2026-09-01&to=2026-09-30&platform=android"),
      );

      expect(mockRpc).toHaveBeenCalledWith("analytics_feature_usage", {
        p_from: "2026-09-01",
        p_to: "2026-09-30",
        p_platform: "android",
      });
    });
  });

  describe("GET /admin/analytics/activation-funnel", () => {
    it("forwards the platform filter", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      await app.request(
        createAuthRequest(
          "/admin/analytics/activation-funnel?from=2026-09-01&to=2026-09-30&platform=ios",
        ),
      );

      expect(mockRpc).toHaveBeenCalledWith("analytics_activation_funnel", {
        p_from: "2026-09-01",
        p_to: "2026-09-30",
        p_platform: "ios",
      });
    });

    it("returns the steps in order", async () => {
      mockRpc.mockResolvedValue({
        data: [
          { step: "signed_up", users: 10 },
          { step: "logged_attendance", users: 4 },
          { step: "five_days", users: 1 },
        ],
        error: null,
      });

      const res = await app.request(
        createAuthRequest("/admin/analytics/activation-funnel?from=2026-09-01&to=2026-09-30"),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        steps: [
          { step: "signed_up", users: 10 },
          { step: "logged_attendance", users: 4 },
          { step: "five_days", users: 1 },
        ],
      });
      expect(mockRpc).toHaveBeenCalledWith("analytics_activation_funnel", {
        p_from: "2026-09-01",
        p_to: "2026-09-30",
      });
    });
  });

  describe("GET /admin/analytics/festival-retention", () => {
    it("maps rows to camelCase and keeps a pending next as null", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            festival_id: "f2",
            festival_name: "Oktoberfest 2026",
            start_date: "2026-09-19",
            attendees: 40,
            returned_next: null,
            returned_any: 0,
          },
          {
            festival_id: "f1",
            festival_name: "Oktoberfest 2025",
            start_date: "2025-09-20",
            attendees: 30,
            returned_next: 9,
            returned_any: 12,
          },
        ],
        error: null,
      });

      const res = await app.request(createAuthRequest("/admin/analytics/festival-retention"));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        festivals: [
          {
            festivalId: "f2",
            festivalName: "Oktoberfest 2026",
            startDate: "2026-09-19",
            attendees: 40,
            returnedNext: null,
            returnedAny: 0,
          },
          {
            festivalId: "f1",
            festivalName: "Oktoberfest 2025",
            startDate: "2025-09-20",
            attendees: 30,
            returnedNext: 9,
            returnedAny: 12,
          },
        ],
      });
      expect(mockRpc).toHaveBeenCalledWith("analytics_festival_retention");
    });
  });

  describe("GET /admin/analytics/scorecard", () => {
    const sqlRow = {
      feature: "drinks",
      attendees: 40,
      adopters: 30,
      came_back_users: 20,
      came_back_users_base: 30,
      came_back_non_users: 3,
      came_back_non_users_base: 10,
      returned_users: 8,
      returned_users_base: 30,
      returned_non_users: 1,
      returned_non_users_base: 10,
    };

    it("pools every festival when none is given", async () => {
      mockRpc.mockResolvedValue({ data: [sqlRow], error: null });

      const res = await app.request(createAuthRequest("/admin/analytics/scorecard"));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        features: [
          {
            feature: "drinks",
            attendees: 40,
            adopters: 30,
            cameBackUsers: 20,
            cameBackUsersBase: 30,
            cameBackNonUsers: 3,
            cameBackNonUsersBase: 10,
            returnedUsers: 8,
            returnedUsersBase: 30,
            returnedNonUsers: 1,
            returnedNonUsersBase: 10,
          },
        ],
      });
      expect(mockRpc).toHaveBeenCalledWith("analytics_feature_scorecard", {});
    });

    it("forwards the festival", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      await app.request(
        createAuthRequest(
          "/admin/analytics/scorecard?festivalId=22222222-2222-4222-8222-222222222222",
        ),
      );

      expect(mockRpc).toHaveBeenCalledWith("analytics_feature_scorecard", {
        p_festival_id: "22222222-2222-4222-8222-222222222222",
      });
    });

    it("rejects a festival id that is not a uuid", async () => {
      const res = await app.request(
        createAuthRequest("/admin/analytics/scorecard?festivalId=oktoberfest"),
      );

      expect(res.status).toBe(400);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("answers 500 when the function fails", async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });

      const res = await app.request(createAuthRequest("/admin/analytics/scorecard"));

      expect(res.status).toBe(500);
    });
  });

  describe("GET /admin/analytics/cohorts", () => {
    it("maps rows to camelCase", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            month: "2026-09-01",
            signups: 20,
            activated: 10,
            activated_7d: 6,
            engaged: 4,
            returned: 2,
          },
        ],
        error: null,
      });

      const res = await app.request(createAuthRequest("/admin/analytics/cohorts"));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        cohorts: [
          {
            month: "2026-09-01",
            signups: 20,
            activated: 10,
            activated7d: 6,
            engaged: 4,
            returned: 2,
          },
        ],
      });
      expect(mockRpc).toHaveBeenCalledWith("analytics_signup_cohorts");
    });
  });
});
