import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockChain,
  createMockSupabase,
  mockSupabaseError,
  mockSupabaseSuccess,
} from "../../__tests__/helpers/mock-supabase";
import {
  createAuthRequest,
  createMockUser,
  createTestApp,
} from "../../__tests__/helpers/test-server";
import crowdReportRoute from "../crowd-report.route";

describe("Crowd Report Routes - Unit Tests", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockUser: ReturnType<typeof createMockUser>;

  const festivalId = "123e4567-e89b-12d3-a456-426614174000";
  const tentId = "223e4567-e89b-12d3-a456-426614174001";

  beforeEach(() => {
    app = createTestApp();
    mockSupabase = createMockSupabase();
    mockUser = createMockUser();

    // Mock auth middleware by setting context directly - MUST come before route mounting
    app.use("*", async (c, next) => {
      const authHeader = c.req.header("Authorization");

      // Routes without auth header should fail with 401
      if (!authHeader) {
        return c.json(
          { error: "Unauthorized", message: "Missing authorization header" },
          401,
        );
      }

      // Set mock user and supabase for authenticated requests
      c.set("user", mockUser);
      c.set("supabase", mockSupabase);
      await next();
    });

    // Mount route after middleware
    app.route("/", crowdReportRoute);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /tents/crowd-status", () => {
    it("should return crowd status for all tents in a festival", async () => {
      const mockCrowdStatus = [
        {
          tent_id: tentId,
          tent_name: "Hofbräu-Festzelt",
          festival_id: festivalId,
          report_count: 5,
          crowd_level: "moderate",
          avg_wait_minutes: 12.5,
          last_reported_at: "2026-02-25T14:30:00Z",
        },
        {
          tent_id: "323e4567-e89b-12d3-a456-426614174002",
          tent_name: "Schottenhamel",
          festival_id: festivalId,
          report_count: 3,
          crowd_level: "crowded",
          avg_wait_minutes: 25.0,
          last_reported_at: "2026-02-25T14:25:00Z",
        },
      ];

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockCrowdStatus)),
      );

      const req = createAuthRequest(
        `/tents/crowd-status?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(2);
      expect(body.data[0]).toEqual({
        tentId,
        tentName: "Hofbräu-Festzelt",
        festivalId,
        reportCount: 5,
        crowdLevel: "moderate",
        avgWaitMinutes: 12.5,
        lastReportedAt: "2026-02-25T14:30:00Z",
      });
      expect(body.data[1]).toEqual({
        tentId: "323e4567-e89b-12d3-a456-426614174002",
        tentName: "Schottenhamel",
        festivalId,
        reportCount: 3,
        crowdLevel: "crowded",
        avgWaitMinutes: 25.0,
        lastReportedAt: "2026-02-25T14:25:00Z",
      });
      expect(mockSupabase.from).toHaveBeenCalledWith("tent_crowd_status");
    });

    it("should return empty array when no crowd data exists", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const req = createAuthRequest(
        `/tents/crowd-status?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
    });

    it("should handle null data from database gracefully", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null }),
      );

      const req = createAuthRequest(
        `/tents/crowd-status?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
    });

    it("should return 500 on database error", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseError("Failed to fetch crowd status", "PGRST000"),
        ),
      );

      const req = createAuthRequest(
        `/tents/crowd-status?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as any;
      expect(body.error).toBeDefined();
      expect(body.error.statusCode).toBe(500);
    });

    it("should validate festivalId is a valid UUID", async () => {
      const req = createAuthRequest(
        "/tents/crowd-status?festivalId=invalid-uuid",
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 when festivalId is missing", async () => {
      const req = createAuthRequest("/tents/crowd-status", {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should handle null avg_wait_minutes", async () => {
      const mockCrowdStatus = [
        {
          tent_id: tentId,
          tent_name: "Hofbräu-Festzelt",
          festival_id: festivalId,
          report_count: 2,
          crowd_level: "empty",
          avg_wait_minutes: null,
          last_reported_at: "2026-02-25T14:30:00Z",
        },
      ];

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockCrowdStatus)),
      );

      const req = createAuthRequest(
        `/tents/crowd-status?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data[0].avgWaitMinutes).toBeNull();
    });

    it("should require authentication", async () => {
      const req = new Request(
        `http://localhost/tents/crowd-status?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /tents/:tentId/crowd-reports", () => {
    it("should return recent crowd reports for a tent", async () => {
      const mockReports = [
        {
          id: "423e4567-e89b-12d3-a456-426614174003",
          tent_id: tentId,
          festival_id: festivalId,
          user_id: "523e4567-e89b-12d3-a456-426614174004",
          crowd_level: "moderate",
          wait_time_minutes: 10,
          created_at: "2026-02-25T14:30:00Z",
          profiles: {
            username: "beermaster",
            full_name: "John Doe",
            avatar_url: "https://example.com/avatar.jpg",
          },
        },
        {
          id: "623e4567-e89b-12d3-a456-426614174005",
          tent_id: tentId,
          festival_id: festivalId,
          user_id: "723e4567-e89b-12d3-a456-426614174006",
          crowd_level: "crowded",
          wait_time_minutes: 20,
          created_at: "2026-02-25T14:25:00Z",
          profiles: {
            username: "oktofan",
            full_name: null,
            avatar_url: null,
          },
        },
      ];

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockReports)),
      );

      const req = createAuthRequest(
        `/tents/${tentId}/crowd-reports?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(2);
      expect(body.data[0]).toEqual({
        id: "423e4567-e89b-12d3-a456-426614174003",
        tentId,
        festivalId,
        userId: "523e4567-e89b-12d3-a456-426614174004",
        crowdLevel: "moderate",
        waitTimeMinutes: 10,
        createdAt: "2026-02-25T14:30:00Z",
        username: "beermaster",
        fullName: "John Doe",
        avatarUrl: "https://example.com/avatar.jpg",
      });
      expect(body.data[1]).toEqual({
        id: "623e4567-e89b-12d3-a456-426614174005",
        tentId,
        festivalId,
        userId: "723e4567-e89b-12d3-a456-426614174006",
        crowdLevel: "crowded",
        waitTimeMinutes: 20,
        createdAt: "2026-02-25T14:25:00Z",
        username: "oktofan",
        fullName: null,
        avatarUrl: null,
      });
      expect(mockSupabase.from).toHaveBeenCalledWith("tent_crowd_reports");
    });

    it("should return empty array when no reports exist", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const req = createAuthRequest(
        `/tents/${tentId}/crowd-reports?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
    });

    it("should handle null data from database gracefully", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null }),
      );

      const req = createAuthRequest(
        `/tents/${tentId}/crowd-reports?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
    });

    it("should return 500 on database error", async () => {
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseError("Failed to fetch tent reports", "PGRST000"),
        ),
      );

      const req = createAuthRequest(
        `/tents/${tentId}/crowd-reports?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as any;
      expect(body.error).toBeDefined();
      expect(body.error.statusCode).toBe(500);
    });

    it("should validate tentId is a valid UUID", async () => {
      const req = createAuthRequest(
        `/tents/invalid-uuid/crowd-reports?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should validate festivalId is a valid UUID", async () => {
      const req = createAuthRequest(
        `/tents/${tentId}/crowd-reports?festivalId=invalid-uuid`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 when festivalId is missing", async () => {
      const req = createAuthRequest(`/tents/${tentId}/crowd-reports`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400);
    });

    it("should handle reports with missing profile data", async () => {
      const mockReports = [
        {
          id: "423e4567-e89b-12d3-a456-426614174003",
          tent_id: tentId,
          festival_id: festivalId,
          user_id: "523e4567-e89b-12d3-a456-426614174004",
          crowd_level: "full",
          wait_time_minutes: null,
          created_at: "2026-02-25T14:30:00Z",
          profiles: null,
        },
      ];

      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockReports)),
      );

      const req = createAuthRequest(
        `/tents/${tentId}/crowd-reports?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data[0].username).toBe("Unknown");
      expect(body.data[0].fullName).toBeNull();
      expect(body.data[0].avatarUrl).toBeNull();
    });

    it("should require authentication", async () => {
      const req = new Request(
        `http://localhost/tents/${tentId}/crowd-reports?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /tents/:tentId/crowd-report", () => {
    const validBody = {
      festivalId,
      crowdLevel: "moderate" as const,
      waitTimeMinutes: 10,
    };

    it("should submit a crowd report successfully", async () => {
      const mockCreatedReport = {
        id: "823e4567-e89b-12d3-a456-426614174007",
        crowd_level: "moderate",
        wait_time_minutes: 10,
        created_at: "2026-02-25T14:35:00Z",
      };

      // First call: hasRecentReport (count query)
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null, count: 0 }),
      );

      // Second call: submitReport (insert + select + single)
      const insertChain = createMockChain(
        mockSupabaseSuccess(mockCreatedReport),
      );
      insertChain.single.mockResolvedValue(
        mockSupabaseSuccess(mockCreatedReport),
      );
      vi.mocked(mockSupabase.from).mockReturnValueOnce(insertChain);

      const req = createAuthRequest(`/tents/${tentId}/crowd-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.report).toEqual({
        id: "823e4567-e89b-12d3-a456-426614174007",
        crowdLevel: "moderate",
        waitTimeMinutes: 10,
        createdAt: "2026-02-25T14:35:00Z",
      });
      // Verify both from() calls happened
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
      expect(mockSupabase.from).toHaveBeenNthCalledWith(
        1,
        "tent_crowd_reports",
      );
      expect(mockSupabase.from).toHaveBeenNthCalledWith(
        2,
        "tent_crowd_reports",
      );
    });

    it("should submit a report without waitTimeMinutes", async () => {
      const bodyWithoutWait = {
        festivalId,
        crowdLevel: "empty" as const,
      };

      const mockCreatedReport = {
        id: "823e4567-e89b-12d3-a456-426614174007",
        crowd_level: "empty",
        wait_time_minutes: null,
        created_at: "2026-02-25T14:35:00Z",
      };

      // hasRecentReport
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null, count: 0 }),
      );

      // submitReport
      const insertChain = createMockChain(
        mockSupabaseSuccess(mockCreatedReport),
      );
      insertChain.single.mockResolvedValue(
        mockSupabaseSuccess(mockCreatedReport),
      );
      vi.mocked(mockSupabase.from).mockReturnValueOnce(insertChain);

      const req = createAuthRequest(`/tents/${tentId}/crowd-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyWithoutWait),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.report.crowdLevel).toBe("empty");
      expect(body.report.waitTimeMinutes).toBeNull();
    });

    it("should return 409 when rate limited (recent report exists)", async () => {
      // hasRecentReport returns count > 0
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null, count: 1 }),
      );

      const req = createAuthRequest(`/tents/${tentId}/crowd-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.error).toBeDefined();
      expect(body.error.statusCode).toBe(409);
      expect(body.error.message).toContain("already submitted a report");
      // Should only call from() once (hasRecentReport), not submitReport
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it("should return 500 when hasRecentReport database query fails", async () => {
      // hasRecentReport database error
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseError("Failed to check recent reports", "PGRST000"),
        ),
      );

      const req = createAuthRequest(`/tents/${tentId}/crowd-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(500);
      const body = (await res.json()) as any;
      expect(body.error).toBeDefined();
      expect(body.error.statusCode).toBe(500);
    });

    it("should return 500 when submitReport database insert fails", async () => {
      // hasRecentReport succeeds (no recent report)
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({ data: null, error: null, count: 0 }),
      );

      // submitReport fails
      const insertChain = createMockChain(
        mockSupabaseError("Failed to submit crowd report", "PGRST000"),
      );
      insertChain.single.mockResolvedValue(
        mockSupabaseError("Failed to submit crowd report", "PGRST000"),
      );
      vi.mocked(mockSupabase.from).mockReturnValueOnce(insertChain);

      const req = createAuthRequest(`/tents/${tentId}/crowd-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(500);
      const body = (await res.json()) as any;
      expect(body.error).toBeDefined();
      expect(body.error.statusCode).toBe(500);
    });

    it("should validate tentId is a valid UUID", async () => {
      const req = createAuthRequest("/tents/invalid-uuid/crowd-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should validate festivalId is required in body", async () => {
      const req = createAuthRequest(`/tents/${tentId}/crowd-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crowdLevel: "moderate",
          waitTimeMinutes: 10,
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should validate crowdLevel is required in body", async () => {
      const req = createAuthRequest(`/tents/${tentId}/crowd-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          festivalId,
          waitTimeMinutes: 10,
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should validate crowdLevel is a valid enum value", async () => {
      const req = createAuthRequest(`/tents/${tentId}/crowd-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          festivalId,
          crowdLevel: "packed",
          waitTimeMinutes: 10,
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should validate festivalId is a valid UUID in body", async () => {
      const req = createAuthRequest(`/tents/${tentId}/crowd-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          festivalId: "invalid-uuid",
          crowdLevel: "moderate",
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should validate waitTimeMinutes is not negative", async () => {
      const req = createAuthRequest(`/tents/${tentId}/crowd-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          festivalId,
          crowdLevel: "moderate",
          waitTimeMinutes: -5,
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should validate waitTimeMinutes does not exceed 180", async () => {
      const req = createAuthRequest(`/tents/${tentId}/crowd-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          festivalId,
          crowdLevel: "moderate",
          waitTimeMinutes: 200,
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(400);
    });

    it("should accept all valid crowd levels", async () => {
      const crowdLevels = ["empty", "moderate", "crowded", "full"] as const;

      for (const crowdLevel of crowdLevels) {
        vi.clearAllMocks();

        // Reset the mock chain for each iteration
        const mockFrom = vi
          .fn()
          .mockImplementation(() =>
            createMockChain({ data: null, error: null }),
          );
        (mockSupabase as any).from = mockFrom;

        // hasRecentReport
        mockFrom.mockReturnValueOnce(
          createMockChain({ data: null, error: null, count: 0 }),
        );

        // submitReport
        const mockCreatedReport = {
          id: "823e4567-e89b-12d3-a456-426614174007",
          crowd_level: crowdLevel,
          wait_time_minutes: null,
          created_at: "2026-02-25T14:35:00Z",
        };
        const insertChain = createMockChain(
          mockSupabaseSuccess(mockCreatedReport),
        );
        insertChain.single.mockResolvedValue(
          mockSupabaseSuccess(mockCreatedReport),
        );
        mockFrom.mockReturnValueOnce(insertChain);

        const req = createAuthRequest(`/tents/${tentId}/crowd-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ festivalId, crowdLevel }),
        });

        const res = await app.request(req as Request);

        expect(res.status).toBe(201);
        const body = (await res.json()) as any;
        expect(body.report.crowdLevel).toBe(crowdLevel);
      }
    });

    it("should require authentication", async () => {
      const req = new Request(`http://localhost/tents/${tentId}/crowd-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });
  });

  describe("Authentication", () => {
    it("should require authentication for GET /tents/crowd-status", async () => {
      const req = new Request(
        `http://localhost/tents/crowd-status?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });

    it("should require authentication for GET /tents/:tentId/crowd-reports", async () => {
      const req = new Request(
        `http://localhost/tents/${tentId}/crowd-reports?festivalId=${festivalId}`,
        { method: "GET" },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });

    it("should require authentication for POST /tents/:tentId/crowd-report", async () => {
      const req = new Request(`http://localhost/tents/${tentId}/crowd-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          festivalId,
          crowdLevel: "moderate",
          waitTimeMinutes: 10,
        }),
      });

      const res = await app.request(req as Request);

      expect(res.status).toBe(401);
    });
  });
});
