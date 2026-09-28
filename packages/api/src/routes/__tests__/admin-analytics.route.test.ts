import type { AnalyticsMembersResponse, AnalyticsTimelineResponse } from "@prostcounter/shared";
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

/**
 * A PostgREST builder stand-in: chainable filters, awaitable result. The
 * repository filters member RPCs with .eq/.gte/.range before awaiting them.
 */
function queryResult(data: unknown[]) {
  const builder = {
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    range: vi.fn(() => builder),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data, error: null }),
  };
  return builder;
}

const PROFILE_ROWS = [
  {
    user_id: "22222222-2222-4222-8222-222222222222",
    username: "ana",
    full_name: "Ana",
    signed_up_at: "2026-09-01T10:00:00+00:00",
    last_active_day: "2026-09-20",
  },
];

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

  describe("GET /admin/analytics/funnel/members", () => {
    it("lists the step's members by minimum attendance days", async () => {
      const members = queryResult([
        { user_id: "22222222-2222-4222-8222-222222222222", attendance_days: 6 },
      ]);
      mockRpc.mockImplementation((fn: string) =>
        fn === "analytics_member_profiles" ? queryResult(PROFILE_ROWS) : members,
      );

      const res = await app.request(
        createAuthRequest(
          "/admin/analytics/funnel/members?from=2026-09-01&to=2026-09-30&step=five_days",
        ),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        members: [
          {
            userId: "22222222-2222-4222-8222-222222222222",
            username: "ana",
            fullName: "Ana",
            signedUpAt: "2026-09-01T10:00:00+00:00",
            lastActiveDay: "2026-09-20",
          },
        ],
        truncated: false,
      });
      expect(mockRpc).toHaveBeenCalledWith("analytics_funnel_members", {
        p_from: "2026-09-01",
        p_to: "2026-09-30",
      });
      expect(members.gte).toHaveBeenCalledWith("attendance_days", 5);
      expect(mockRpc).toHaveBeenCalledWith("analytics_member_profiles", {
        p_user_ids: ["22222222-2222-4222-8222-222222222222"],
      });
    });

    it("skips the profile lookup when nobody matches", async () => {
      mockRpc.mockImplementation(() => queryResult([]));

      const res = await app.request(
        createAuthRequest(
          "/admin/analytics/funnel/members?from=2026-09-01&to=2026-09-30&step=signed_up",
        ),
      );

      expect(await res.json()).toEqual({ members: [], truncated: false });
      expect(mockRpc).not.toHaveBeenCalledWith("analytics_member_profiles", expect.anything());
    });

    it("rejects an unknown step without calling the database", async () => {
      const res = await app.request(
        createAuthRequest(
          "/admin/analytics/funnel/members?from=2026-09-01&to=2026-09-30&step=ten_days",
        ),
      );

      expect(res.status).toBe(400);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("flags a list that hits the row cap", async () => {
      const rows = Array.from({ length: 1000 }, (_, index) => ({
        user_id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        attendance_days: 1,
      }));
      mockRpc.mockImplementation((fn: string) =>
        fn === "analytics_member_profiles" ? queryResult([]) : queryResult(rows),
      );

      const res = await app.request(
        createAuthRequest(
          "/admin/analytics/funnel/members?from=2026-09-01&to=2026-09-30&step=signed_up",
        ),
      );
      const body = (await res.json()) as AnalyticsMembersResponse;

      expect(body.truncated).toBe(true);
      expect(body.members).toHaveLength(1000);
    });
  });

  describe("GET /admin/analytics/scorecard/members", () => {
    it("filters by feature and the segment's flags, with festival names", async () => {
      const members = queryResult([
        {
          feature: "photos",
          festival_id: "33333333-3333-4333-8333-333333333333",
          festival_name: "Oktoberfest 2026",
          user_id: "22222222-2222-4222-8222-222222222222",
          is_user: true,
          came_back: true,
          successor_started: false,
          returned: false,
        },
      ]);
      mockRpc.mockImplementation((fn: string) =>
        fn === "analytics_member_profiles" ? queryResult(PROFILE_ROWS) : members,
      );

      const res = await app.request(
        createAuthRequest(
          "/admin/analytics/scorecard/members?feature=photos&segment=came_back_adopters&festivalId=33333333-3333-4333-8333-333333333333",
        ),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as AnalyticsMembersResponse;
      expect(body.members).toEqual([
        {
          userId: "22222222-2222-4222-8222-222222222222",
          username: "ana",
          fullName: "Ana",
          signedUpAt: "2026-09-01T10:00:00+00:00",
          lastActiveDay: "2026-09-20",
          festivalId: "33333333-3333-4333-8333-333333333333",
          festivalName: "Oktoberfest 2026",
        },
      ]);
      expect(mockRpc).toHaveBeenCalledWith("analytics_scorecard_members", {
        p_festival_id: "33333333-3333-4333-8333-333333333333",
      });
      expect(members.eq).toHaveBeenCalledWith("feature", "photos");
      expect(members.eq).toHaveBeenCalledWith("is_user", true);
      expect(members.eq).toHaveBeenCalledWith("came_back", true);
    });

    it("pools every festival without festivalId", async () => {
      mockRpc.mockImplementation(() => queryResult([]));

      await app.request(
        createAuthRequest("/admin/analytics/scorecard/members?feature=photos&segment=attendees"),
      );

      expect(mockRpc).toHaveBeenCalledWith("analytics_scorecard_members", {});
    });

    it("rejects an unknown segment", async () => {
      const res = await app.request(
        createAuthRequest("/admin/analytics/scorecard/members?feature=photos&segment=fans"),
      );

      expect(res.status).toBe(400);
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe("GET /admin/analytics/cohorts/members", () => {
    it("filters by month and the step's flag", async () => {
      const members = queryResult([]);
      mockRpc.mockImplementation(() => members);

      const res = await app.request(
        createAuthRequest("/admin/analytics/cohorts/members?month=2026-09-01&step=activated_7d"),
      );

      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith("analytics_cohort_members");
      expect(members.eq).toHaveBeenCalledWith("month", "2026-09-01");
      expect(members.eq).toHaveBeenCalledWith("activated_7d", true);
    });

    it("rejects a month that is not a month start", async () => {
      const res = await app.request(
        createAuthRequest("/admin/analytics/cohorts/members?month=2026-09-15&step=signups"),
      );

      expect(res.status).toBe(400);
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe("GET /admin/users/{userId}/timeline", () => {
    const USER_ID = "22222222-2222-4222-8222-222222222222";
    const ROW = {
      occurred_at: "2026-09-28T10:00:00.123456+00:00",
      kind: "event",
      name: "app_opened",
      props: { source: "cold" },
      festival_id: null,
      festival_name: null,
      platform: "ios",
      app_version: "3.1.0",
      session_id: "44444444-4444-4444-8444-444444444444",
      cursor_key: "event:7",
    };

    it("returns a page with no next cursor when it is short", async () => {
      mockRpc.mockResolvedValue({ data: [ROW], error: null });

      const res = await app.request(createAuthRequest(`/admin/users/${USER_ID}/timeline`));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        rows: [
          {
            occurredAt: "2026-09-28T10:00:00.123456+00:00",
            kind: "event",
            name: "app_opened",
            props: { source: "cold" },
            festivalId: null,
            festivalName: null,
            platform: "ios",
            appVersion: "3.1.0",
            sessionId: "44444444-4444-4444-8444-444444444444",
            cursorKey: "event:7",
          },
        ],
        nextCursor: null,
      });
      expect(mockRpc).toHaveBeenCalledWith("analytics_user_timeline", {
        p_user_id: USER_ID,
        p_limit: 100,
      });
    });

    it("returns the last row as the next cursor when the page is full", async () => {
      mockRpc.mockResolvedValue({ data: [ROW], error: null });

      const res = await app.request(
        createAuthRequest(`/admin/users/${USER_ID}/timeline?limit=1&kind=event`),
      );

      expect(((await res.json()) as AnalyticsTimelineResponse).nextCursor).toEqual({
        cursorAt: "2026-09-28T10:00:00.123456+00:00",
        cursorKey: "event:7",
      });
      expect(mockRpc).toHaveBeenCalledWith("analytics_user_timeline", {
        p_user_id: USER_ID,
        p_limit: 1,
        p_kind: "event",
      });
    });

    it("passes the cursor through verbatim", async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      await app.request(
        createAuthRequest(
          `/admin/users/${USER_ID}/timeline?cursorAt=${encodeURIComponent("2026-09-28T10:00:00.123456+00:00")}&cursorKey=event%3A7&kind=all`,
        ),
      );

      expect(mockRpc).toHaveBeenCalledWith("analytics_user_timeline", {
        p_user_id: USER_ID,
        p_limit: 100,
        p_cursor_at: "2026-09-28T10:00:00.123456+00:00",
        p_cursor_key: "event:7",
      });
    });

    it("rejects a cursor without its key", async () => {
      const res = await app.request(
        createAuthRequest(
          `/admin/users/${USER_ID}/timeline?cursorAt=${encodeURIComponent("2026-09-28T10:00:00+00:00")}`,
        ),
      );

      expect(res.status).toBe(400);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("rejects a user id that is not a uuid", async () => {
      const res = await app.request(createAuthRequest("/admin/users/nope/timeline"));

      expect(res.status).toBe(400);
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });
});
