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
import attendanceRoutes from "../attendance.route";

describe("Attendance Routes - Unit Tests", () => {
  let app: ReturnType<typeof createTestApp>;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockUser: ReturnType<typeof createMockUser>;

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
    app.route("/", attendanceRoutes);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /attendance", () => {
    it("should list user's attendances with pagination", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const mockAttendances = [
        {
          id: "223e4567-e89b-12d3-a456-426614174001",
          user_id: mockUser.id,
          festival_id: festivalId,
          date: "2024-09-21",
          created_at: "2024-09-21T10:00:00Z",
          updated_at: "2024-09-21T10:00:00Z",
          drink_count: 3,
          beer_count: 2,
          total_spent_cents: 4860,
          total_tip_cents: 60,
          avg_price_cents: 1620,
        },
        {
          id: "223e4567-e89b-12d3-a456-426614174002",
          user_id: mockUser.id,
          festival_id: festivalId,
          date: "2024-09-22",
          created_at: "2024-09-22T10:00:00Z",
          updated_at: "2024-09-22T10:00:00Z",
          drink_count: 2,
          beer_count: 2,
          total_spent_cents: 3240,
          total_tip_cents: 40,
          avg_price_cents: 1620,
        },
      ];

      const mockTentVisits = [
        {
          tent_id: "323e4567-e89b-12d3-a456-426614174001",
          visit_date: "2024-09-21T14:00:00Z",
          tents: { name: "Hofbräu-Festzelt" },
        },
      ];

      // Mock count query (head: true)
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({
          data: null,
          error: null,
          count: 2,
        }),
      );

      // Mock data query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockAttendances)),
      );

      // Mock tent visits query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(mockTentVisits)),
      );

      const req = createAuthRequest(
        `/attendance?festivalId=${festivalId}&limit=10&offset=0`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: "223e4567-e89b-12d3-a456-426614174001",
            userId: mockUser.id,
            festivalId: festivalId,
            date: "2024-09-21",
            drinkCount: 3,
            beerCount: 2,
          }),
          expect.objectContaining({
            id: "223e4567-e89b-12d3-a456-426614174002",
            userId: mockUser.id,
            festivalId: festivalId,
            date: "2024-09-22",
            drinkCount: 2,
            beerCount: 2,
          }),
        ]),
        total: 2,
        limit: 10,
        offset: 0,
      });
    });

    it("should handle empty attendance list", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      // Mock count query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({
          data: null,
          error: null,
          count: 0,
        }),
      );

      // Mock data query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      // Mock tent visits query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const req = createAuthRequest(
        `/attendance?festivalId=${festivalId}&limit=10&offset=0`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        data: [],
        total: 0,
        limit: 10,
        offset: 0,
      });
    });

    it("should apply pagination correctly", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const mockAttendances = [
        {
          id: "223e4567-e89b-12d3-a456-426614174003",
          user_id: mockUser.id,
          festival_id: festivalId,
          date: "2024-09-23",
          created_at: "2024-09-23T10:00:00Z",
          updated_at: "2024-09-23T10:00:00Z",
          drink_count: 1,
          beer_count: 1,
          total_spent_cents: 1620,
          total_tip_cents: 20,
          avg_price_cents: 1620,
        },
      ];

      // Mock count query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain({
          data: null,
          error: null,
          count: 10,
        }),
      );

      // Mock data query with range
      const mockBuilder = createMockChain(mockSupabaseSuccess(mockAttendances));
      vi.mocked(mockSupabase.from).mockReturnValueOnce(mockBuilder);

      // Mock tent visits query
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess([])),
      );

      const req = createAuthRequest(
        `/attendance?festivalId=${festivalId}&limit=5&offset=5`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.limit).toBe(5);
      expect(body.offset).toBe(5);
      expect(body.total).toBe(10);

      // Verify range was called with correct params
      expect(mockBuilder.range).toHaveBeenCalledWith(5, 9); // offset to offset + limit - 1
    });

    it("should validate required festivalId query parameter", async () => {
      const req = createAuthRequest(`/attendance?limit=10&offset=0`, {
        method: "GET",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400); // Bad request
    });

    it("should handle database errors gracefully", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      // Mock count query with error
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseError("Failed to count attendances", "PGRST000"),
        ),
      );

      const req = createAuthRequest(
        `/attendance?festivalId=${festivalId}&limit=10&offset=0`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /attendance/:id", () => {
    it("should delete an attendance successfully", async () => {
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      // Mock findById - attendance exists
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess({
            id: attendanceId,
            user_id: mockUser.id,
            festival_id: festivalId,
            date: "2024-09-21",
            created_at: "2024-09-21T10:00:00Z",
            updated_at: "2024-09-21T10:00:00Z",
            drink_count: 3,
            beer_count: 2,
            total_spent_cents: 4860,
            total_tip_cents: 60,
            avg_price_cents: 1620,
          }),
        ),
      );

      // Mock photo delete (deleteByAttendanceId)
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(null)),
      );

      // Mock attendance delete - verify ownership check
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
      );

      // Mock attendance delete operation
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess(null)),
      );

      const req = createAuthRequest(`/attendance/${attendanceId}`, {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        success: true,
        message: "Attendance deleted successfully",
      });
    });

    it("should return 404 when attendance does not exist", async () => {
      const attendanceId = "223e4567-e89b-12d3-a456-426614174999";

      // Mock findById - attendance not found
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseError("Not found", "PGRST116")),
      );

      const req = createAuthRequest(`/attendance/${attendanceId}`, {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: expect.objectContaining({
          message: "ATTENDANCE_NOT_FOUND",
          code: "ATTENDANCE_NOT_FOUND",
          statusCode: 404,
        }),
      });
    });

    it("should prevent deleting another user's attendance", async () => {
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const otherUserId = "423e4567-e89b-12d3-a456-426614174999";

      // Mock findById - attendance exists
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess({
            id: attendanceId,
            user_id: mockUser.id,
            festival_id: festivalId,
            date: "2024-09-21",
            created_at: "2024-09-21T10:00:00Z",
            updated_at: "2024-09-21T10:00:00Z",
            drink_count: 3,
            beer_count: 2,
            total_spent_cents: 4860,
            total_tip_cents: 60,
            avg_price_cents: 1620,
          }),
        ),
      );

      // Mock ownership check - different user
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess({ user_id: otherUserId })),
      );

      const req = createAuthRequest(`/attendance/${attendanceId}`, {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(500); // Repository throws DatabaseError
    });

    it("should validate UUID format for attendance ID", async () => {
      const req = createAuthRequest(`/attendance/invalid-uuid`, {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(400); // Bad request
    });

    it("should handle database errors during delete", async () => {
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";

      // Mock findById - attendance exists
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseSuccess({
            id: attendanceId,
            user_id: mockUser.id,
            festival_id: festivalId,
            date: "2024-09-21",
            created_at: "2024-09-21T10:00:00Z",
            updated_at: "2024-09-21T10:00:00Z",
            drink_count: 3,
            beer_count: 2,
            total_spent_cents: 4860,
            total_tip_cents: 60,
            avg_price_cents: 1620,
          }),
        ),
      );

      // Mock ownership check
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(mockSupabaseSuccess({ user_id: mockUser.id })),
      );

      // Mock delete operation with error
      vi.mocked(mockSupabase.from).mockReturnValueOnce(
        createMockChain(
          mockSupabaseError("Failed to delete attendance", "PGRST000"),
        ),
      );

      const req = createAuthRequest(`/attendance/${attendanceId}`, {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(500);
    });
  });

  describe("Authentication", () => {
    it("should require authentication for GET /attendance", async () => {
      const festivalId = "123e4567-e89b-12d3-a456-426614174000";
      const req = new Request(
        `http://localhost/attendance?festivalId=${festivalId}&limit=10&offset=0`,
        {
          method: "GET",
        },
      );

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });

    it("should require authentication for DELETE /attendance/:id", async () => {
      const attendanceId = "223e4567-e89b-12d3-a456-426614174001";
      const req = new Request(`http://localhost/attendance/${attendanceId}`, {
        method: "DELETE",
      });

      const res = await app.request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      expect(res.status).toBe(401);
    });
  });
});
